'use server';

import { AppError } from '@/lib/errors';
import { generateTournamentRound } from '@/lib/pairing-generators/utils';
import { sortUnitsByResults } from '@/lib/tournament-results';
import { db, type Database } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import {
  games,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { getStatusInTournamentWithClubId } from '@/server/queries/get-status-in-tournament';
import { getPersistedTournamentGames } from '@/server/queries/get-tournament-games';
import { getRawTournamentUnits } from '@/server/queries/get-tournament-units';
import { GameResult } from '@/server/zod/enums';
import {
  GameModel,
  SaveRoundInputModel,
  SetGameResultInputModel,
} from '@/server/zod/tournaments';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { getUnitResultDeltas } from './set-game-result-deltas';

export async function replaceRoundGames({
  tournamentId,
  roundNumber,
  newGames,
  database,
}: {
  tournamentId: string;
  roundNumber: number;
  newGames: GameModel[];
  database?: Pick<typeof db, 'delete' | 'insert' | 'update'>;
}) {
  const run = async (d: Pick<typeof db, 'delete' | 'insert' | 'update'>) => {
    await d
      .delete(games)
      .where(
        and(
          eq(games.tournamentId, tournamentId),
          eq(games.roundNumber, roundNumber),
        ),
      );

    await d
      .update(tournaments)
      .set({ ongoingRound: roundNumber })
      .where(
        and(
          eq(tournaments.id, tournamentId),
          ne(tournaments.ongoingRound, roundNumber),
        ),
      );

    if (newGames.length === 0) return;
    await d.insert(games).values(newGames);
  };

  if (database) {
    await run(database);
    return;
  }

  await db.transaction(async (tx) => run(tx));
}

const hasSameRoundProjection = (
  submittedGames: SaveRoundInputModel['newGames'],
  generatedGames: GameModel[],
) => {
  if (submittedGames.length !== generatedGames.length) return false;

  const submittedByNumber = submittedGames.toSorted(
    (a, b) => a.gameNumber - b.gameNumber,
  );
  const generatedByNumber = generatedGames.toSorted(
    (a, b) => a.gameNumber - b.gameNumber,
  );

  return submittedByNumber.every((submitted, index) => {
    const generated = generatedByNumber[index];
    return (
      generated !== undefined &&
      submitted.gameNumber === generated.gameNumber &&
      submitted.roundNumber === generated.roundNumber &&
      submitted.roundName === generated.roundName &&
      submitted.whiteUnitId === generated.whiteUnitId &&
      submitted.blackUnitId === generated.blackUnitId &&
      submitted.whitePlayerId === generated.whitePlayerId &&
      submitted.blackPlayerId === generated.blackPlayerId &&
      submitted.whitePrevGameId === generated.whitePrevGameId &&
      submitted.blackPrevGameId === generated.blackPrevGameId &&
      submitted.result === generated.result &&
      submitted.finishedAt === generated.finishedAt &&
      submitted.tournamentId === generated.tournamentId
    );
  });
};

export async function saveRound({
  tournamentId,
  roundNumber,
  newGames,
}: SaveRoundInputModel): Promise<GameModel[]> {
  return await db.transaction(async (tx) => {
    const tournament = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .then((rows) => rows.at(0));
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (!tournament.startedAt) throw new AppError('TOURNAMENT_NOT_STARTED');
    if (tournament.closedAt) {
      throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    }

    const allGames = await getPersistedTournamentGames(tournamentId, tx);
    if (roundNumber === tournament.ongoingRound) {
      const persistedRound = allGames.filter(
        (game) => game.roundNumber === roundNumber,
      );
      if (persistedRound.length === 0) {
        throw new AppError('NO_TOURNAMENT_DATA');
      }
      return persistedRound;
    }

    if (roundNumber !== tournament.ongoingRound + 1) {
      throw new AppError('INVALID_ROUND_PROGRESSION');
    }
    if (
      tournament.roundsNumber === null ||
      tournament.ongoingRound >= tournament.roundsNumber
    ) {
      throw new AppError('INVALID_ROUNDS_NUMBER');
    }

    const currentRound = allGames.filter(
      (game) => game.roundNumber === tournament.ongoingRound,
    );
    if (
      currentRound.length === 0 ||
      currentRound.some((game) => game.result === null)
    ) {
      throw new AppError('INCOMPLETE_GAMES');
    }

    const rawUnits = await getRawTournamentUnits(tournamentId, tx);
    const units = sortUnitsByResults(rawUnits, tournament, allGames);
    const generatedGames = generateTournamentRound(tournament.format, {
      players: units,
      games: allGames,
      roundNumber,
      tournamentId,
    });
    if (generatedGames.length === 0) {
      throw new AppError('NOT_ENOUGH_TOURNAMENT_UNITS');
    }
    if (!hasSameRoundProjection(newGames, generatedGames)) {
      throw new AppError('ROUND_PROJECTION_MISMATCH');
    }

    const advancement = await tx
      .update(tournaments)
      .set({ ongoingRound: roundNumber })
      .where(
        and(
          eq(tournaments.id, tournamentId),
          eq(tournaments.ongoingRound, roundNumber - 1),
        ),
      );
    if (!advancement.rowsAffected) {
      throw new AppError('INVALID_ROUND_PROGRESSION');
    }

    await tx.insert(games).values(generatedGames);
    return generatedGames;
  });
}

export async function setTournamentGameResult(
  { gameId, result }: SetGameResultInputModel,
  userId: string,
) {
  const gameContext = (
    await db
      .select({
        tournamentId: games.tournamentId,
        whiteUnitId: games.whiteUnitId,
        blackUnitId: games.blackUnitId,
        startedAt: tournaments.startedAt,
        closedAt: tournaments.closedAt,
        clubId: tournaments.clubId,
        allowPlayersSetResults: clubs.allowPlayersSetResults,
      })
      .from(games)
      .innerJoin(tournaments, eq(games.tournamentId, tournaments.id))
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(eq(games.id, gameId))
  ).at(0);
  if (!gameContext) throw new AppError('GAME_NOT_FOUND');

  const { tournamentId } = gameContext;
  const { status: authStatus, unitId: authUnitId } =
    await getStatusInTournamentWithClubId(
      userId,
      tournamentId,
      gameContext.clubId,
    );
  if (authStatus === 'viewer') throw new AppError('FORBIDDEN');
  if (gameContext.startedAt === null) {
    throw new AppError('TOURNAMENT_NOT_STARTED');
  }
  if (gameContext.closedAt !== null) {
    throw new AppError('TOURNAMENT_ALREADY_FINISHED');
  }

  if (authStatus === 'player') {
    if (!gameContext.allowPlayersSetResults) {
      throw new AppError('PLAYER_RESULT_SETTING_DISABLED');
    }

    const isPlayerUnitInGame =
      authUnitId === gameContext.whiteUnitId ||
      authUnitId === gameContext.blackUnitId;
    if (!isPlayerUnitInGame) throw new AppError('NOT_YOUR_GAME');
  }

  await db.transaction(async (tx) => {
    const game = (
      await tx
        .select({ result: games.result })
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.tournamentId, tournamentId)))
    ).at(0);
    if (!game) throw new AppError('GAME_NOT_FOUND');

    const gameUnits = await tx
      .select({ isOut: tournament_units.isOut })
      .from(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          inArray(tournament_units.id, [
            gameContext.whiteUnitId,
            gameContext.blackUnitId,
          ]),
        ),
      );

    if (gameUnits.length !== 2) {
      throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
    }
    if (gameUnits.some((unit) => unit.isOut)) {
      throw new AppError('WITHDRAWN_UNIT_CANNOT_PLAY');
    }
    if (game.result === result) return;

    await applyGameResult({
      database: tx,
      tournamentId,
      gameId,
      whiteUnitId: gameContext.whiteUnitId,
      blackUnitId: gameContext.blackUnitId,
      prevResult: game.result,
      nextResult: result,
    });
  });
}

/**
 * Applies a game result inside a caller-owned transaction.
 *
 * Pure DB logic — no auth, no transaction wrapping, no isOut guard, no toggle.
 * Callers (setTournamentGameResult, withdraw unit's forfeit loop) handle
 * those concerns themselves.
 *
 * Steps (top-to-bottom):
 *   1. Compute wins/draws/losses/colorIndex deltas via getPlayerResultDeltas.
 *   2. UPDATE white unit's stat counters with the deltas.
 *   3. UPDATE black unit's stat counters with the deltas.
 *   4. UPDATE the game row with nextResult and finishedAt.
 *
 * `finishedAt` is set to now when nextResult is non-null and cleared when
 * nextResult is null.
 */
export async function applyGameResult({
  database,
  tournamentId,
  gameId,
  whiteUnitId,
  blackUnitId,
  prevResult,
  nextResult,
}: {
  database: Database;
  tournamentId: string;
  gameId: string;
  whiteUnitId: string;
  blackUnitId: string;
  prevResult: GameResult | null;
  nextResult: GameResult | null;
}): Promise<void> {
  const whiteMatch = and(
    eq(tournament_units.tournamentId, tournamentId),
    eq(tournament_units.id, whiteUnitId),
  );
  const blackMatch = and(
    eq(tournament_units.tournamentId, tournamentId),
    eq(tournament_units.id, blackUnitId),
  );

  const deltas = getUnitResultDeltas(prevResult, nextResult);

  const whiteUpdate = await database
    .update(tournament_units)
    .set({
      wins: sql`COALESCE(${tournament_units.wins}, 0) + ${deltas.white.wins}`,
      draws: sql`COALESCE(${tournament_units.draws}, 0) + ${deltas.white.draws}`,
      losses: sql`COALESCE(${tournament_units.losses}, 0) + ${deltas.white.losses}`,
      colorIndex: sql`COALESCE(${tournament_units.colorIndex}, 0) + ${deltas.white.colorIndex}`,
    })
    .where(whiteMatch);
  if (!whiteUpdate.rowsAffected) {
    throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
  }

  const blackUpdate = await database
    .update(tournament_units)
    .set({
      wins: sql`COALESCE(${tournament_units.wins}, 0) + ${deltas.black.wins}`,
      draws: sql`COALESCE(${tournament_units.draws}, 0) + ${deltas.black.draws}`,
      losses: sql`COALESCE(${tournament_units.losses}, 0) + ${deltas.black.losses}`,
      colorIndex: sql`COALESCE(${tournament_units.colorIndex}, 0) + ${deltas.black.colorIndex}`,
    })
    .where(blackMatch);
  if (!blackUpdate.rowsAffected) {
    throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
  }

  let finishedAt: Date | null;
  if (nextResult === null) {
    finishedAt = null;
  } else {
    finishedAt = new Date();
  }

  const gameUpdate = await database
    .update(games)
    .set({ result: nextResult, finishedAt })
    .where(and(eq(games.id, gameId), eq(games.tournamentId, tournamentId)));
  if (!gameUpdate.rowsAffected) throw new AppError('GAME_NOT_FOUND');
}
