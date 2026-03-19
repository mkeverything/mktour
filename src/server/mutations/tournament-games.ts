'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { GameModel } from '@/server/zod/tournaments';
import { GameResult } from '@/server/zod/enums';
import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getPlayerResultDeltas } from './set-game-result-deltas';

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
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

  if (tournament.format === 'swiss') {
    const activeParticipants = await db
      .select({
        playerId: players_to_tournaments.playerId,
      })
      .from(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          or(
            isNull(players_to_tournaments.isOut),
            eq(players_to_tournaments.isOut, false),
          ),
        ),
      );

    const activePlayerIds = new Set(
      activeParticipants.map((participant) => participant.playerId),
    );
    const hasWithdrawnParticipant = newGames.some(
      (game) =>
        !activePlayerIds.has(game.whiteId) ||
        !activePlayerIds.has(game.blackId),
    );

    if (hasWithdrawnParticipant) {
      throw new Error('WITHDRAWN_PLAYER_IN_PAIRING');
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
  const cleanupPromises = [
    db
      .delete(games)
      .where(
        and(
          eq(games.tournamentId, tournamentId),
          eq(games.roundNumber, roundNumber),
        ),
      ),
    db
      .update(tournaments)
      .set({ ongoingRound: roundNumber })
      .where(eq(tournaments.id, tournamentId)),
  ];

  await Promise.all(cleanupPromises);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertPromises: Promise<any>[] = [];
  newGames.forEach((game) => {
    const { blackNickname, whiteNickname, pairMembers, ...newGame } = game;
    insertPromises.push(db.insert(games).values(newGame));
  });

  await Promise.all(insertPromises);
}

export async function setTournamentGameResult({
  gameId,
  result,
  tournamentId,
}: {
  tournamentId: string;
  gameId: string;
  result: GameResult;
  whiteId: string;
  blackId: string;
  prevResult: GameResult | null;
  roundNumber: number;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  const authStatus = await getStatusInTournament(user.id, tournamentId);
  if (authStatus.status === 'viewer') throw new Error('NOT_AUTHORIZED');

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
  if (!tournamentWithClub) throw new Error('TOURNAMENT NOT FOUND');
  if (tournamentWithClub.startedAt === null)
    throw new Error('TOURNAMENT_NOT_STARTED');
  if (tournamentWithClub.closedAt !== null) {
    throw new Error('TOURNAMENT_ALREADY_FINISHED');
  }

  await db.transaction(async (tx) => {
    const game = (
      await tx
        .select({
          whiteId: games.whiteId,
          blackId: games.blackId,
          result: games.result,
        })
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.tournamentId, tournamentId)))
    ).at(0);
    if (!game) throw new Error('GAME_NOT_FOUND');

    const [whiteParticipant, blackParticipant] = await Promise.all([
      tx
        .select({
          teamNickname: players_to_tournaments.teamNickname,
          isOut: players_to_tournaments.isOut,
        })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, game.whiteId),
          ),
        )
        .then((rows) => rows.at(0)),
      tx
        .select({
          teamNickname: players_to_tournaments.teamNickname,
          isOut: players_to_tournaments.isOut,
        })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, game.blackId),
          ),
        )
        .then((rows) => rows.at(0)),
    ]);

    if (whiteParticipant?.isOut || blackParticipant?.isOut) {
      throw new Error('WITHDRAWN_PLAYER_CANNOT_PLAY');
    }

    if (authStatus.status === 'player') {
      if (!tournamentWithClub.allowPlayersSetResults) {
        throw new Error('PLAYER_RESULT_SETTING_DISABLED');
      }
      const authParticipant = await tx
        .select({
          playerId: players_to_tournaments.playerId,
          teamNickname: players_to_tournaments.teamNickname,
        })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, authStatus.playerId),
          ),
        )
        .then((rows) => rows.at(0));

      const isPlayerInGame =
        authStatus.playerId === game.whiteId ||
        authStatus.playerId === game.blackId ||
        (!!authParticipant?.teamNickname &&
          (authParticipant.teamNickname === whiteParticipant?.teamNickname ||
            authParticipant.teamNickname === blackParticipant?.teamNickname));
      if (!isPlayerInGame) throw new Error('NOT_YOUR_GAME');
    }

    const nextResult: GameResult | null =
      game.result === result ? null : result;
    const deltas = getPlayerResultDeltas(game.result, nextResult);

    const whitePlayerUpdate = await tx
      .update(players_to_tournaments)
      .set({
        wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + ${deltas.white.wins}`,
        draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + ${deltas.white.draws}`,
        losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + ${deltas.white.losses}`,
        colorIndex: sql`COALESCE(${players_to_tournaments.colorIndex}, 0) + ${deltas.white.colorIndex}`,
      })
      .where(
        whiteParticipant?.teamNickname
          ? and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(
                players_to_tournaments.teamNickname,
                whiteParticipant.teamNickname,
              ),
            )
          : and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.playerId, game.whiteId),
            ),
      );
    if (!whitePlayerUpdate.rowsAffected) {
      throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
    }

    const blackPlayerUpdate = await tx
      .update(players_to_tournaments)
      .set({
        wins: sql`COALESCE(${players_to_tournaments.wins}, 0) + ${deltas.black.wins}`,
        draws: sql`COALESCE(${players_to_tournaments.draws}, 0) + ${deltas.black.draws}`,
        losses: sql`COALESCE(${players_to_tournaments.losses}, 0) + ${deltas.black.losses}`,
      })
      .where(
        blackParticipant?.teamNickname
          ? and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(
                players_to_tournaments.teamNickname,
                blackParticipant.teamNickname,
              ),
            )
          : and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.playerId, game.blackId),
            ),
      );
    if (!blackPlayerUpdate.rowsAffected) {
      throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
    }

    const currentResultCondition =
      game.result === null
        ? isNull(games.result)
        : eq(games.result, game.result);
    const gameUpdate = await tx
      .update(games)
      .set({
        result: nextResult,
        finishedAt: nextResult ? new Date() : null,
      })
      .where(
        and(
          eq(games.id, gameId),
          eq(games.tournamentId, tournamentId),
          currentResultCondition,
        ),
      );
    if (!gameUpdate.rowsAffected)
      throw new Error('CONCURRENT_GAME_RESULT_UPDATE');
  });
}
