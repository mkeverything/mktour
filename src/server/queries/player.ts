import { caseWhen } from '@/lib/sql-case-when';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { PlayerAuthStatsModel, PlayerStatsModel } from '@/server/zod/players';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  or,
} from 'drizzle-orm';

// returns the last 5 tournaments a player participated in
export async function getPlayersTournamentsInfinite(
  playerId: string,
  limit: number = 5,
  offset: number = 0,
) {
  return await db
    .select({
      ...getTableColumns(tournaments),
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

  const clubPlayersStats = await db
    .select({
      playerId: players.id,
      ratingPeak: players.ratingPeak,
      tournamentsPlayed: countDistinct(players_to_units.id),
      wins: countDistinct(
        caseWhen(
          or(
            and(eq(games.whitePlayerId, players.id), eq(games.result, '1-0')),
            and(eq(games.blackPlayerId, players.id), eq(games.result, '0-1')),
          ),
          games.id,
        ).elseNull(),
      ),
      losses: countDistinct(
        caseWhen(
          or(
            and(eq(games.whitePlayerId, players.id), eq(games.result, '0-1')),
            and(eq(games.blackPlayerId, players.id), eq(games.result, '1-0')),
          ),
          games.id,
        ).elseNull(),
      ),
      draws: countDistinct(
        caseWhen(eq(games.result, '1/2-1/2'), games.id).elseNull(),
      ),
    })
    .from(players)
    .leftJoin(players_to_units, eq(players.id, players_to_units.playerId))
    .leftJoin(
      games,
      or(
        eq(players.id, games.whitePlayerId),
        eq(players.id, games.blackPlayerId),
      ),
    )
    .where(eq(players.clubId, player.clubId))
    .groupBy(players.id)
    .orderBy(desc(players.lastSeenAt));

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
