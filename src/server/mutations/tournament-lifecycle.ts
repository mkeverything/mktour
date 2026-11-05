import 'server-only';

import { validateRequest } from '@/lib/auth/lucia';
import { AppError } from '@/lib/errors';
import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import {
  baselineUnitSort,
  buildScoreMaps,
  hasSameStanding,
  sortUnitsByResults,
} from '@/lib/tournament-results';
import {
  getRoundRobinRoundsNumber,
  getSwissMaxRoundsNumber,
  newid,
} from '@/lib/utils';
import { db, type Database, type Transaction } from '@/server/db';
import { lockClubs, lockTournament } from '@/server/db/locks';
import { user_notifications } from '@/server/db/schema/notifications';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { publishUserNotification } from '@/server/events';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { getTournamentGames } from '@/server/queries/get-tournament-games';
import {
  getRawTournamentUnits,
  getTournamentUnits,
} from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import { TournamentFormat } from '@/server/zod/enums';
import {
  GameModel,
  NewTournamentFormModel,
  TournamentModel,
  TournamentStartInputModel,
  tournamentsInsertSchema,
  UnitModel,
} from '@/server/zod/tournaments';
import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { refreshPlayerStats } from '@/server/mutations/player-stats';
import { calculateAndApplyGlickoRatings } from './rating-calculation';
import { replaceRoundGames } from './tournament-games';
import { applyPreStartUnitOrder } from './tournament-unit-order';

export const createTournament = async (
  values: Omit<NewTournamentFormModel, 'date'> & {
    date: string;
  },
) => {
  if (values.type !== 'solo' && values.rated) {
    throw new AppError('DOUBLES_TOURNAMENT_CANNOT_BE_RATED');
  }
  const newTournamentID = newid();
  const newTournament = tournamentsInsertSchema.parse({
    ...values,
    id: newTournamentID,
    createdAt: new Date(),
    closedAt: null,
    startedAt: null,
    // round robin gets its rounds number at start, from the final player count
    roundsNumber: values.format === 'swiss' ? 1 : 0,
    ongoingRound: 1,
  });

  await db.insert(tournaments).values(newTournament);
  return { id: newTournamentID };
};

async function resolveTournamentRoundsNumber({
  tournamentId,
  format,
  roundsNumber,
}: {
  tournamentId: string;
  format: TournamentFormat;
  roundsNumber: number;
}) {
  if (format === 'swiss') {
    const units = await getTournamentUnits(tournamentId);
    if (units.length < 2) throw new AppError('NOT_ENOUGH_TOURNAMENT_UNITS');

    const maxRounds = getSwissMaxRoundsNumber(units.length);
    if (roundsNumber < 1 || roundsNumber > maxRounds) {
      throw new AppError('INVALID_ROUNDS_NUMBER');
    }

    return roundsNumber;
  }
  if (format === 'round robin') {
    const units = await getTournamentUnits(tournamentId);
    return getRoundRobinRoundsNumber(units.length);
  }
  throw new AppError('UNSUPPORTED_TOURNAMENT_FORMAT');
}

export async function normalizeSwissRoundsNumber(
  tournamentId: string,
): Promise<{
  roundsNumber: number;
  wasChanged: boolean;
} | null> {
  return await normalizeSwissRoundsNumberInDatabase(tournamentId, db);
}

function getEligibleSwissUnits(
  tournament: TournamentModel,
  units: Array<UnitModel>,
) {
  if (!tournament.startedAt && units.some((unit) => unit.isOut === true)) {
    throw new AppError('INVALID_PRE_START_WITHDRAWN_UNIT');
  }

  return tournament.startedAt
    ? units.filter((unit) => unit.isOut !== true)
    : units;
}

export async function normalizeSwissRoundsNumberInDatabase(
  tournamentId: string,
  database: Database,
): Promise<{
  roundsNumber: number;
  wasChanged: boolean;
} | null> {
  const tournament = await getTournamentById(tournamentId, database);
  if (!tournament || tournament.format !== 'swiss') return null;
  if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');

  const units = await getTournamentUnits(tournamentId, database);
  const eligibleUnits = getEligibleSwissUnits(tournament, units);
  const maxRounds = getSwissMaxRoundsNumber(eligibleUnits.length);
  const minRounds = tournament.startedAt ? tournament.ongoingRound : 1;
  if (minRounds > maxRounds) {
    throw new AppError('WITHDRAWAL_REDUCES_ROUNDS_BELOW_CURRENT');
  }
  const normalizedRounds = Math.min(
    Math.max(tournament.roundsNumber, minRounds),
    maxRounds,
  );

  const updateResult = await database
    .update(tournaments)
    .set({ roundsNumber: normalizedRounds })
    .where(
      and(
        eq(tournaments.id, tournamentId),
        isNull(tournaments.closedAt),
        ne(tournaments.roundsNumber, normalizedRounds),
      ),
    );

  return {
    roundsNumber: normalizedRounds,
    wasChanged: !!updateResult.rowCount,
  };
}

async function preparePreStartPairings(
  tournamentId: string,
  database: Transaction,
): Promise<GameModel[]> {
  const currentUnits = await getRawTournamentUnits(tournamentId, database);
  if (currentUnits.length < 2) {
    throw new AppError('NOT_ENOUGH_TOURNAMENT_UNITS');
  }
  const units = await applyPreStartUnitOrder({
    tournamentId,
    orderedUnits: currentUnits.toSorted(baselineUnitSort),
    database,
  });
  const roundGames = generatePreStartRoundGames({ units, tournamentId });
  await replaceRoundGames({
    tournamentId,
    roundNumber: 1,
    newGames: roundGames,
    database,
  });
  return roundGames;
}

export async function startTournament({
  tournamentId,
  startedAt,
  format,
  roundsNumber,
}: TournamentStartInputModel) {
  const { user } = await validateRequest();
  if (!user) throw new AppError('UNAUTHENTICATED');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new AppError('NOT_TOURNAMENT_ORGANIZER');

  const finalRoundsNumber = await resolveTournamentRoundsNumber({
    tournamentId,
    format,
    roundsNumber,
  });

  return await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    const roundGames = await preparePreStartPairings(tournamentId, tx);
    const value = await tx
      .update(tournaments)
      .set({ startedAt, roundsNumber: finalRoundsNumber })
      .where(
        and(eq(tournaments.id, tournamentId), isNull(tournaments.startedAt)),
      );
    if (!value.rowCount) throw new AppError('TOURNAMENT_ALREADY_STARTED');
    return roundGames;
  });
}

export async function resetTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new AppError('UNAUTHENTICATED');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new AppError('NOT_TOURNAMENT_ORGANIZER');
  await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (tournament.closedAt) throw new AppError('FINISHED_TOURNAMENT_IS_FINAL');
    const tournamentUpdate = await tx
      .update(tournaments)
      .set({
        startedAt: null,
        ongoingRound: 1,
      })
      .where(
        and(
          eq(tournaments.id, tournamentId),
          isNotNull(tournaments.startedAt),
          isNull(tournaments.closedAt),
        ),
      );
    if (!tournamentUpdate.rowCount)
      throw new AppError('TOURNAMENT_ALREADY_RESET');

    await tx.delete(games).where(eq(games.tournamentId, tournamentId));

    await tx
      .update(tournament_units)
      .set({
        wins: 0,
        draws: 0,
        losses: 0,
        colorIndex: 0,
        place: null,
        isOut: false,
      })
      .where(eq(tournament_units.tournamentId, tournamentId));
  });
}

export async function finishTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new AppError('UNAUTHENTICATED');

  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new AppError('NOT_TOURNAMENT_ORGANIZER');

  const { closedAt, winnerIds } = await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    await lockClubs(tx, [tournament.clubId]);
    const allGames = await getTournamentGames(tournamentId, tx);
    // react-doctor-disable-next-line react-doctor/server-sequential-independent-await
    const unitsUnsorted = await getRawTournamentUnits(tournamentId, tx);

    if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (!tournament.startedAt) throw new AppError('TOURNAMENT_NOT_STARTED');
    if (
      tournament.ongoingRound !== tournament.roundsNumber ||
      !allGames.some((game) => game.roundNumber === tournament.ongoingRound)
    )
      throw new AppError('TOURNAMENT_NOT_COMPLETED');

    if (allGames.some((game) => game.result === null)) {
      throw new AppError('INCOMPLETE_GAMES');
    }

    const closedAt = new Date();
    const result = await tx
      .update(tournaments)
      .set({ closedAt })
      .where(
        and(eq(tournaments.id, tournamentId), isNull(tournaments.closedAt)),
      );
    if (!result.rowCount) throw new AppError('TOURNAMENT_ALREADY_FINISHED');

    const sortedUnits = sortUnitsByResults(unitsUnsorted, tournament, allGames);
    const { unitScoresMap, tiebreakScoresMap } = buildScoreMaps(
      sortedUnits,
      tournament,
      allGames,
    );

    sortedUnits.forEach((unit, i) => {
      if (i === 0) {
        unit.place = 1;
      } else {
        const prevUnit = sortedUnits[i - 1];
        unit.place = hasSameStanding(
          unit,
          prevUnit,
          unitScoresMap,
          tiebreakScoresMap,
        )
          ? prevUnit.place
          : i + 1;
      }
    });

    for (const unit of sortedUnits) {
      // statements on one transaction connection run one at a time anyway.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await tx
        .update(tournament_units)
        .set({ place: unit.place })
        .where(eq(tournament_units.id, unit.id));
    }

    const playerIds = sortedUnits.flatMap((unit) =>
      unit.players.map((player) => player.id),
    );
    await tx
      .update(players)
      .set({ lastSeenAt: closedAt })
      .where(inArray(players.id, playerIds));

    if (tournament.rated) {
      await calculateAndApplyGlickoRatings(tournamentId, tx, closedAt);
    }

    await refreshPlayerStats(tx, {
      clubId: tournament.clubId,
      playerIds,
    });

    const winnerIds = sortedUnits
      .filter((unit) => unit.place === 1)
      .flatMap((unit) =>
        unit.players.flatMap(({ userId }) => (userId ? [userId] : [])),
      );
    if (winnerIds.length) {
      await tx.insert(user_notifications).values(
        winnerIds.map((userId) => ({
          id: newid(),
          userId,
          event: 'tournament_won' as const,
          tournamentId,
        })),
      );
    }

    return { closedAt, winnerIds };
  });
  for (const userId of winnerIds) publishUserNotification(userId);
  return { closedAt };
}

export async function deleteTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new AppError('UNAUTHENTICATED');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new AppError('NOT_TOURNAMENT_ORGANIZER');
  await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    await lockClubs(tx, [tournament.clubId]);
    const participants = await tx
      .select({ playerId: players_to_units.playerId })
      .from(players_to_units)
      .where(eq(players_to_units.tournamentId, tournamentId));
    await tx.delete(tournaments).where(eq(tournaments.id, tournamentId));

    if (tournament.closedAt) {
      await refreshPlayerStats(tx, {
        clubId: tournament.clubId,
        playerIds: participants.map((participant) => participant.playerId),
      });
    }
  });
}

export async function updateSwissRoundsNumber({
  tournamentId,
  roundsNumber,
}: {
  tournamentId: string;
  roundsNumber: number;
}) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
  if (tournament.format !== 'swiss') throw new AppError('NOT_SWISS_TOURNAMENT');
  if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');

  const units = await getTournamentUnits(tournamentId);
  const eligibleUnits = getEligibleSwissUnits(tournament, units);
  const maxRounds = getSwissMaxRoundsNumber(eligibleUnits.length);
  const minRounds = tournament.startedAt ? tournament.ongoingRound : 1;
  if (roundsNumber < minRounds) throw new AppError('INVALID_ROUNDS_NUMBER');
  if (roundsNumber > maxRounds) throw new AppError('INVALID_ROUNDS_NUMBER');

  const result = await db
    .update(tournaments)
    .set({ roundsNumber })
    .where(and(eq(tournaments.id, tournamentId), isNull(tournaments.closedAt)));
  if (!result.rowCount) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
}

export async function editTournamentTitle({
  tournamentId,
  title,
}: {
  tournamentId: string;
  title: string;
}) {
  const result = await db
    .update(tournaments)
    .set({ title })
    .where(and(eq(tournaments.id, tournamentId), isNull(tournaments.closedAt)));
  if (!result.rowCount) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
}
