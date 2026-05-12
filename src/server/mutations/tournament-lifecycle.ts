'use server';

import { validateRequest } from '@/lib/auth/lucia';
import {
  buildScoreMaps,
  hasSameStanding,
  sortUnitsByResults,
} from '@/lib/tournament-results';
import {
  getRoundRobinRoundsNumber,
  getSwissMaxRoundsNumber,
  getSwissRecommendedRoundsNumber,
  newid,
} from '@/lib/utils';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { getTournamentGames } from '@/server/queries/get-tournament-games';
import {
  getRawTournamentUnits,
  getTournamentUnits,
} from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import { TournamentFormat } from '@/server/zod/enums';
import {
  NewTournamentFormModel,
  TournamentModel,
  tournamentsInsertSchema,
  UnitModel,
} from '@/server/zod/tournaments';
import { and, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { calculateAndApplyGlickoRatings } from './rating-calculation';
import { reapplyPreStartOrder } from './tournament-unit-order';

export const createTournament = async (
  values: Omit<NewTournamentFormModel, 'date'> & {
    date: string;
  },
) => {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const newTournamentID = newid();
  const resolvedRated = values.type === 'doubles' ? false : values.rated;
  const newTournament = tournamentsInsertSchema.parse({
    ...values,
    rated: resolvedRated,
    id: newTournamentID,
    createdAt: new Date(),
    closedAt: null,
    startedAt: null,
    roundsNumber: values.format === 'swiss' ? 1 : null,
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
  roundsNumber: number | null;
}) {
  if (format === 'swiss') {
    const units = await getTournamentUnits(tournamentId);
    if (units.length < 2) throw new Error('NOT_ENOUGH_PARTICIPANTS');

    const maxRounds = getSwissMaxRoundsNumber(units.length);
    const resolvedRounds =
      roundsNumber ?? getSwissRecommendedRoundsNumber(units.length);

    if (resolvedRounds < 1 || resolvedRounds > maxRounds) {
      throw new Error('INVALID_ROUNDS_NUMBER');
    }

    return resolvedRounds;
  }
  if (format === 'round robin') {
    const units = await getTournamentUnits(tournamentId);
    return getRoundRobinRoundsNumber(units.length);
  }
  throw new Error('UNSUPPORTED_TOURNAMENT_FORMAT');
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
    throw new Error('INVALID_PRE_START_WITHDRAWN_UNIT');
  }

  return tournament.startedAt
    ? units.filter((unit) => unit.isOut !== true)
    : units;
}

export async function normalizeSwissRoundsNumberInDatabase(
  tournamentId: string,
  database: Pick<typeof db, 'select' | 'update'>,
): Promise<{
  roundsNumber: number;
  wasChanged: boolean;
} | null> {
  const tournament = await getTournamentById(tournamentId, database);
  if (!tournament || tournament.format !== 'swiss') return null;

  const units = await getTournamentUnits(tournamentId, database);
  const eligibleUnits = getEligibleSwissUnits(tournament, units);
  const maxRounds = getSwissMaxRoundsNumber(eligibleUnits.length);
  const minRounds = tournament.startedAt ? tournament.ongoingRound : 1;
  if (minRounds > maxRounds) {
    throw new Error('WITHDRAWAL_REDUCES_ROUNDS_BELOW_CURRENT');
  }
  const normalizedRounds = Math.min(
    Math.max(tournament.roundsNumber ?? minRounds, minRounds),
    maxRounds,
  );

  const updateResult = await database
    .update(tournaments)
    .set({ roundsNumber: normalizedRounds })
    .where(
      and(
        eq(tournaments.id, tournamentId),
        or(
          isNull(tournaments.roundsNumber),
          ne(tournaments.roundsNumber, normalizedRounds),
        ),
      ),
    );

  return {
    roundsNumber: normalizedRounds,
    wasChanged: updateResult.rowsAffected > 0,
  };
}

async function preparePreStartPairings(
  tournamentId: string,
  database: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>,
) {
  const units = await getTournamentUnits(tournamentId, database);
  if (units.length < 2) {
    throw new Error('NOT_ENOUGH_PLAYERS');
  }
  await reapplyPreStartOrder(tournamentId, database, {
    skipFinalReads: true,
  });
}

export async function startTournament({
  tournamentId,
  startedAt,
  format,
  roundsNumber,
}: Pick<TournamentModel, 'format' | 'roundsNumber' | 'startedAt'> & {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');

  const finalRoundsNumber = await resolveTournamentRoundsNumber({
    tournamentId,
    format,
    roundsNumber,
  });

  await db.transaction(async (tx) => {
    await preparePreStartPairings(tournamentId, tx);
    const value = await tx
      .update(tournaments)
      .set({ startedAt, roundsNumber: finalRoundsNumber })
      .where(
        and(eq(tournaments.id, tournamentId), isNull(tournaments.startedAt)),
      );
    if (!value.rowsAffected) throw new Error('TOURNAMENT_ALREADY_GOING');
  });
}

export async function resetTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');
  await db.transaction(async (tx) => {
    const tournamentUpdate = await tx
      .update(tournaments)
      .set({
        startedAt: null,
        ongoingRound: 1,
        closedAt: null,
      })
      .where(
        and(eq(tournaments.id, tournamentId), isNotNull(tournaments.startedAt)),
      );
    if (!tournamentUpdate.rowsAffected)
      throw new Error('TOURNAMENT_ALREADY_RESET');

    await tx
      .delete(games)
      .where(
        and(eq(games.tournamentId, tournamentId), ne(games.roundNumber, 1)),
      );

    await tx
      .update(tournament_units)
      .set({
        wins: 0,
        draws: 0,
        losses: 0,
        colorIndex: 0,
        place: null,
        isOut: null,
      })
      .where(eq(tournament_units.tournamentId, tournamentId));

    await tx
      .update(games)
      .set({ result: null, finishedAt: null })
      .where(eq(games.tournamentId, tournamentId));
  });
}

export async function finishTournament({
  tournamentId,
  closedAt,
}: {
  tournamentId: string;
  closedAt: Date;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');

  const allGames = await getTournamentGames(tournamentId);
  const unitsUnsorted = await getRawTournamentUnits(tournamentId);

  await db.transaction(async (tx) => {
    if (closedAt) {
      const result = await tx
        .update(tournaments)
        .set({ closedAt })
        .where(
          and(eq(tournaments.id, tournamentId), isNull(tournaments.closedAt)),
        );
      if (!result.rowsAffected) throw new Error('TOURNAMENT_ALREADY_FINISHED');
    }

    const tournament = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .then((rows) => rows[0]);

    if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

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

    await Promise.all(
      sortedUnits.flatMap((unit) => {
        const playerIds = unit.players.map((player) => player.id);

        return [
          tx
            .update(tournament_units)
            .set({ place: unit.place })
            .where(eq(tournament_units.id, unit.id)),
          tx
            .update(players)
            .set({ lastSeenAt: closedAt })
            .where(inArray(players.id, playerIds)),
        ];
      }),
    );

    if (tournament.rated) {
      await calculateAndApplyGlickoRatings(tournamentId, tx);
    }
  });
}

export async function deleteTournament({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');
  await db.transaction(async (tx) => {
    const units = await tx
      .select({ id: tournament_units.id })
      .from(tournament_units)
      .where(eq(tournament_units.tournamentId, tournamentId));
    if (units.length > 0) {
      const unitIds = units.map((unit) => unit.id);

      await Promise.all([
        tx.delete(games).where(eq(games.tournamentId, tournamentId)),
        tx
          .delete(players_to_units)
          .where(inArray(players_to_units.unitId, unitIds)),
      ]);

      await tx
        .delete(tournament_units)
        .where(eq(tournament_units.tournamentId, tournamentId));
    }

    await tx.delete(tournaments).where(eq(tournaments.id, tournamentId));
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
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.format !== 'swiss') throw new Error('NOT_SWISS_TOURNAMENT');
  if (tournament.closedAt) throw new Error('TOURNAMENT_ALREADY_FINISHED');

  const units = await getTournamentUnits(tournamentId);
  const eligibleUnits = getEligibleSwissUnits(tournament, units);
  const maxRounds = getSwissMaxRoundsNumber(eligibleUnits.length);
  const minRounds = tournament.startedAt ? tournament.ongoingRound : 1;
  if (roundsNumber < minRounds) throw new Error('INVALID_ROUNDS_NUMBER');
  if (roundsNumber > maxRounds) throw new Error('INVALID_ROUNDS_NUMBER');

  await db
    .update(tournaments)
    .set({ roundsNumber })
    .where(eq(tournaments.id, tournamentId));
}

export async function editTournamentTitle({
  tournamentId,
  title,
}: {
  tournamentId: string;
  title: string;
}) {
  await db
    .update(tournaments)
    .set({ title })
    .where(eq(tournaments.id, tournamentId));
}
