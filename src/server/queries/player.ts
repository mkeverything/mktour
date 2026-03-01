import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { PlayerAuthStatsModel, PlayerStatsModel } from '@/server/zod/players';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  or,
  sql,
  sum,
} from 'drizzle-orm';

// returns the last 5 tournaments a player participated in
export async function getPlayersTournaments(
  playerId: string,
  limit: number = 5,
  offset: number = 0,
) {
  return await db
    .select({
      ...getTableColumns(players_to_tournaments),
      tournament: tournaments,
    })
    .from(players_to_tournaments)
    .innerJoin(
      tournaments,
      eq(players_to_tournaments.tournamentId, tournaments.id),
    )
    .where(eq(players_to_tournaments.playerId, playerId))
    .orderBy(desc(tournaments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPlayerStats(
  playerId: string,
): Promise<PlayerStatsModel> {
  const player = await db
    .select({ clubId: players.clubId, ratingPeak: players.ratingPeak })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player)
    return {
      tournamentsPlayed: { value: 0, rank: 0 },
      gamesPlayed: { value: 0, rank: 0 },
      winRate: { value: 0, rank: 0 },
      ratingPeakRank: 0,
    };

  // Get stats for all players in the same club
  const clubPlayersStats = await db
    .select({
      playerId: players.id,
      ratingPeak: players.ratingPeak,
      tournamentsPlayed: count(players_to_tournaments.id),
      wins: sum(players_to_tournaments.wins),
      losses: sum(players_to_tournaments.losses),
      draws: sum(players_to_tournaments.draws),
    })
    .from(players)
    .leftJoin(
      players_to_tournaments,
      eq(players.id, players_to_tournaments.playerId),
    )
    .where(eq(players.clubId, player.clubId))
    .groupBy(players.id);

  const statsWithCalculations = clubPlayersStats.map((p) => {
    const wins = Number(p.wins ?? 0);
    const losses = Number(p.losses ?? 0);
    const draws = Number(p.draws ?? 0);
    const gamesPlayed = wins + losses + draws;
    const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;

    return {
      playerId: p.playerId,
      tournamentsPlayed: p.tournamentsPlayed,
      gamesPlayed,
      winRate,
      ratingPeak: p.ratingPeak,
    };
  });

  const byTournaments = [...statsWithCalculations].sort(
    (a, b) => b.tournamentsPlayed - a.tournamentsPlayed,
  );
  const byGames = [...statsWithCalculations].sort(
    (a, b) => b.gamesPlayed - a.gamesPlayed,
  );
  const byWinRate = [...statsWithCalculations].sort(
    (a, b) => b.winRate - a.winRate,
  );
  const byRatingPeak = [...statsWithCalculations].sort(
    (a, b) => (b.ratingPeak ?? 0) - (a.ratingPeak ?? 0),
  );

  const playerStats = statsWithCalculations.find(
    (p) => p.playerId === playerId,
  );

  if (!playerStats)
    return {
      tournamentsPlayed: { value: 0, rank: 0 },
      gamesPlayed: { value: 0, rank: 0 },
      winRate: { value: 0, rank: 0 },
      ratingPeakRank: 0,
    };

  return {
    tournamentsPlayed: {
      value: playerStats.tournamentsPlayed,
      rank: byTournaments.findIndex((p) => p.playerId === playerId) + 1,
    },
    gamesPlayed: {
      value: playerStats.gamesPlayed,
      rank: byGames.findIndex((p) => p.playerId === playerId) + 1,
    },
    winRate: {
      value: Math.round(playerStats.winRate * 10000) / 100,
      rank: byWinRate.findIndex((p) => p.playerId === playerId) + 1,
    },
    ratingPeakRank: byRatingPeak.findIndex((p) => p.playerId === playerId) + 1,
  };
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
    and(eq(games.whiteId, playerId), eq(games.blackId, authPlayerId)),
    and(eq(games.whiteId, authPlayerId), eq(games.blackId, playerId)),
  );

  const headToHead = await db
    .select({
      playerWins: count(
        sql`CASE
          WHEN (${games.whiteId} = ${playerId} AND ${games.result} = '1-0')
            OR (${games.blackId} = ${playerId} AND ${games.result} = '0-1')
          THEN 1 END`,
      ),
      userWins: count(
        sql`CASE
          WHEN (${games.whiteId} = ${authPlayerId} AND ${games.result} = '1-0')
            OR (${games.blackId} = ${authPlayerId} AND ${games.result} = '0-1')
          THEN 1 END`,
      ),
      draws: count(sql`CASE WHEN ${games.result} = '1/2-1/2' THEN 1 END`),
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
