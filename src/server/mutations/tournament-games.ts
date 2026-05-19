'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { db, type Database } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import {
  games,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { GameResult } from '@/server/zod/enums';
import { GameModel } from '@/server/zod/tournaments';
import { and, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
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

export async function saveRound({
  tournamentId,
  roundNumber,
  newGames,
}: {
  tournamentId: string;
  roundNumber: number;
  newGames: GameModel[];
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status === 'viewer') throw new Error('NOT_ADMIN');
  const tournament = await db
    .select({
      format: tournaments.format,
      type: tournaments.type,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows.at(0));
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  if (tournament.format === 'swiss') {
    const activeUnits = await db
      .select({
        unitId: tournament_units.id,
      })
      .from(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          or(isNull(tournament_units.isOut), eq(tournament_units.isOut, false)),
        ),
      );

    const activeUnitIds = new Set(activeUnits.map((unit) => unit.unitId));
    const hasInvalidUnit = newGames.some(
      (game) =>
        !activeUnitIds.has(game.whiteUnitId) ||
        !activeUnitIds.has(game.blackUnitId),
    );

    if (hasInvalidUnit) {
      throw new Error('INVALID_UNIT_IN_PAIRING');
    }
  }
  const existingDecidedGames = await db
    .select({ id: games.id })
    .from(games)
    .where(
      and(
        eq(games.tournamentId, tournamentId),
        eq(games.roundNumber, roundNumber),
        isNotNull(games.result),
      ),
    )
    .limit(1);
  if (existingDecidedGames.length > 0) {
    throw new Error('ROUND_ALREADY_HAS_RESULTS');
  }
  await replaceRoundGames({ tournamentId, roundNumber, newGames });
}

export async function setTournamentGameResult({
  gameId,
  result,
  tournamentId,
}: {
  tournamentId: string;
  gameId: string;
  result: GameResult;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const { status: authStatus, unitId: authUnitId } =
    await getStatusInTournament(user.id, tournamentId);
  if (authStatus === 'viewer') throw new Error('NOT_AUTHORIZED');

  const tournamentWithClub = (
    await db
      .select({
        startedAt: tournaments.startedAt,
        closedAt: tournaments.closedAt,
        allowPlayersSetResults: clubs.allowPlayersSetResults,
      })
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(eq(tournaments.id, tournamentId))
  ).at(0);
  if (!tournamentWithClub) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournamentWithClub.startedAt === null)
    throw new Error('TOURNAMENT_NOT_STARTED');
  if (tournamentWithClub.closedAt !== null) {
    throw new Error('TOURNAMENT_ALREADY_FINISHED');
  }

  await db.transaction(async (tx) => {
    const game = (
      await tx
        .select({
          whiteUnitId: games.whiteUnitId,
          blackUnitId: games.blackUnitId,
          result: games.result,
        })
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.tournamentId, tournamentId)))
    ).at(0);
    if (!game) throw new Error('GAME_NOT_FOUND');

    const [whiteUnit, blackUnit] = await Promise.all([
      tx
        .select({ isOut: tournament_units.isOut })
        .from(tournament_units)
        .where(
          and(
            eq(tournament_units.tournamentId, tournamentId),
            eq(tournament_units.id, game.whiteUnitId),
          ),
        )
        .then((rows) => rows.at(0)),
      tx
        .select({ isOut: tournament_units.isOut })
        .from(tournament_units)
        .where(
          and(
            eq(tournament_units.tournamentId, tournamentId),
            eq(tournament_units.id, game.blackUnitId),
          ),
        )
        .then((rows) => rows.at(0)),
    ]);

    if (!whiteUnit || !blackUnit) {
      throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
    }

    if (whiteUnit.isOut || blackUnit.isOut) {
      throw new Error('WITHDRAWN_UNIT_CANNOT_PLAY');
    }

    if (authStatus === 'player') {
      if (!tournamentWithClub.allowPlayersSetResults) {
        throw new Error('PLAYER_RESULT_SETTING_DISABLED');
      }

      const isPlayerUnitInGame =
        authUnitId === game.whiteUnitId || authUnitId === game.blackUnitId;
      if (!isPlayerUnitInGame) throw new Error('NOT_YOUR_GAME');
    }

    let nextResult: GameResult | null;
    if (game.result === result) {
      nextResult = null;
    } else {
      nextResult = result;
    }

    await applyGameResult({
      database: tx,
      tournamentId,
      gameId,
      whiteUnitId: game.whiteUnitId,
      blackUnitId: game.blackUnitId,
      prevResult: game.result,
      nextResult,
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
 *   4. UPDATE the game row with nextResult and finishedAt, with optimistic
 *      concurrency check on prevResult.
 *
 * `finishedAt` is set to now when nextResult is non-null, cleared when
 * nextResult is null (the toggle-off case used by setTournamentGameResult).
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
    throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
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
    throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
  }

  let prevResultMatch;
  if (prevResult === null) {
    prevResultMatch = isNull(games.result);
  } else {
    prevResultMatch = eq(games.result, prevResult);
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
    .where(
      and(
        eq(games.id, gameId),
        eq(games.tournamentId, tournamentId),
        prevResultMatch,
      ),
    );
  if (!gameUpdate.rowsAffected) {
    throw new Error('CONCURRENT_GAME_RESULT_UPDATE');
  }
}
