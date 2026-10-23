import { AppError } from '@/lib/errors';
import { caseWhen } from '@/lib/sql-case-when';
import { db } from '@/server/db';
import { player_stats, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { PlayerAuthStatsModel, PlayerStatsModel } from '@/server/zod/players';
import { and, count, desc, eq, getColumns, or } from 'drizzle-orm';

// returns the last 5 tournaments a player participated in
export async function getPlayersTournamentsInfinite(
  playerId: string,
  limit: number = 5,
  offset: number = 0,
) {
  return await db
    .select({
      ...getColumns(tournaments),
    })
    .from(players_to_units)
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .where(eq(players_to_units.playerId, playerId))
    .orderBy(desc(tournaments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPlayerStats(
  playerId: string,
): Promise<PlayerStatsModel> {
  const { playerId: _, clubId, ...statsColumns } = getColumns(player_stats);
  const stats = await db
    .select(statsColumns)
    .from(player_stats)
    .where(eq(player_stats.playerId, playerId))
    .get();

  if (!stats) throw new AppError('PLAYER_NOT_FOUND');
  return stats;
}

export async function getPlayerAuthStats({
  playerId,
  userId,
}: {
  playerId: string;
  userId: string;
}): Promise<PlayerAuthStatsModel | null> {
  const player = await db
    .select({
      clubId: players.clubId,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .get();
  if (!player) return null;

  const authPlayer = await db
    .select({ id: players.id, nickname: players.nickname })
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.clubId, player.clubId)))
    .get();

  if (!authPlayer) return null;
  const authPlayerId = authPlayer.id;
  if (playerId === authPlayerId) return null;

  const headToHeadCondition = or(
    and(
      eq(games.whitePlayerId, playerId),
      eq(games.blackPlayerId, authPlayerId),
    ),
    and(
      eq(games.whitePlayerId, authPlayerId),
      eq(games.blackPlayerId, playerId),
    ),
  );

  const headToHead = await db
    .select({
      playerWins: count(
        caseWhen(
          or(
            and(eq(games.whitePlayerId, playerId), eq(games.result, '1-0')),
            and(eq(games.blackPlayerId, playerId), eq(games.result, '0-1')),
          ),
          1,
        ).elseNull(),
      ),
      userWins: count(
        caseWhen(
          or(
            and(eq(games.whitePlayerId, authPlayerId), eq(games.result, '1-0')),
            and(eq(games.blackPlayerId, authPlayerId), eq(games.result, '0-1')),
          ),
          1,
        ).elseNull(),
      ),
      draws: count(caseWhen(eq(games.result, '1/2-1/2'), 1).elseNull()),
      totalGames: count(games.id),
    })
    .from(games)
    .where(headToHeadCondition)
    .get();

  // Return null if no games exist between these players
  if (!headToHead || headToHead.totalGames === 0) return null;

  const mostRecentGame = await db
    .select({ tournamentId: games.tournamentId })
    .from(games)
    .where(headToHeadCondition)
    .orderBy(desc(games.finishedAt))
    .limit(1)
    .get();

  const lastTournament = mostRecentGame
    ? await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, mostRecentGame.tournamentId))
        .get()
    : null;

  return {
    playerWins: headToHead?.playerWins ?? 0,
    userWins: headToHead?.userWins ?? 0,
    draws: headToHead?.draws ?? 0,
    userPlayerNickname: authPlayer.nickname,
    lastTournament: lastTournament ?? null,
  };
}
