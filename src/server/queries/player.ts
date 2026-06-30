import { clubPlayerStatsTag } from '@/lib/cache-tags';
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
  isNotNull,
  or,
} from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

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

type ClubPlayerStats = PlayerStatsModel & { playerId: string };

type PlayerResultCounts = {
  playerId: string;
  wins: number;
  losses: number;
  draws: number;
};

const EMPTY_PLAYER_STATS: PlayerStatsModel = {
  tournamentsPlayed: { value: 0, rank: null },
  gamesPlayed: { value: 0, rank: null },
  winRate: { value: 0, rank: null },
  ratingPeakRank: null,
};

function getCompetitionRanks<T>(
  items: T[],
  getValue: (item: T) => number,
  getId: (item: T) => string,
) {
  const ranks = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  items.forEach((item, index) => {
    const value = getValue(item);
    const rank = previousValue === value ? previousRank : index + 1;
    ranks.set(getId(item), rank);
    previousValue = value;
    previousRank = rank;
  });

  return ranks;
}

function addResultCounts(
  countsByPlayerId: Map<string, PlayerResultCounts>,
  row: PlayerResultCounts,
) {
  const current = countsByPlayerId.get(row.playerId) ?? {
    playerId: row.playerId,
    wins: 0,
    losses: 0,
    draws: 0,
  };
  current.wins += Number(row.wins ?? 0);
  current.losses += Number(row.losses ?? 0);
  current.draws += Number(row.draws ?? 0);
  countsByPlayerId.set(row.playerId, current);
}

async function getUncachedClubPlayerStats(
  clubId: string,
): Promise<ClubPlayerStats[]> {
  const participationRows = await db
    .select({
      playerId: players_to_units.playerId,
      ratingPeak: players.ratingPeak,
      tournamentsPlayed: countDistinct(tournaments.id),
    })
    .from(players_to_units)
    .innerJoin(players, eq(players.id, players_to_units.playerId))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .where(and(eq(players.clubId, clubId), isNotNull(tournaments.closedAt)))
    .groupBy(players_to_units.playerId);

  const whiteRows = await db
    .select({
      playerId: players_to_units.playerId,
      wins: count(caseWhen(eq(games.result, '1-0'), games.id).elseNull()),
      losses: count(caseWhen(eq(games.result, '0-1'), games.id).elseNull()),
      draws: count(caseWhen(eq(games.result, '1/2-1/2'), games.id).elseNull()),
    })
    .from(players_to_units)
    .innerJoin(players, eq(players.id, players_to_units.playerId))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .innerJoin(games, eq(tournament_units.id, games.whiteUnitId))
    .where(and(eq(players.clubId, clubId), isNotNull(tournaments.closedAt)))
    .groupBy(players_to_units.playerId);

  const blackRows = await db
    .select({
      playerId: players_to_units.playerId,
      wins: count(caseWhen(eq(games.result, '0-1'), games.id).elseNull()),
      losses: count(caseWhen(eq(games.result, '1-0'), games.id).elseNull()),
      draws: count(caseWhen(eq(games.result, '1/2-1/2'), games.id).elseNull()),
    })
    .from(players_to_units)
    .innerJoin(players, eq(players.id, players_to_units.playerId))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .innerJoin(games, eq(tournament_units.id, games.blackUnitId))
    .where(and(eq(players.clubId, clubId), isNotNull(tournaments.closedAt)))
    .groupBy(players_to_units.playerId);

  const countsByPlayerId = new Map<string, PlayerResultCounts>();
  whiteRows.forEach((row) => addResultCounts(countsByPlayerId, row));
  blackRows.forEach((row) => addResultCounts(countsByPlayerId, row));

  const statsWithCalculations = participationRows.map((p) => {
    const counts = countsByPlayerId.get(p.playerId) ?? {
      playerId: p.playerId,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    const wins = Number(counts.wins ?? 0);
    const losses = Number(counts.losses ?? 0);
    const draws = Number(counts.draws ?? 0);
    const gamesPlayed = wins + losses + draws;
    const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;

    return {
      playerId: p.playerId,
      tournamentsPlayed: Number(p.tournamentsPlayed ?? 0),
      gamesPlayed,
      winRate,
      ratingPeak: p.ratingPeak,
    };
  });

  const byTournaments = statsWithCalculations.toSorted(
    (a, b) => b.tournamentsPlayed - a.tournamentsPlayed,
  );
  const byGames = statsWithCalculations.toSorted(
    (a, b) => b.gamesPlayed - a.gamesPlayed,
  );
  const byWinRate = statsWithCalculations
    .filter((p) => p.gamesPlayed > 0)
    .toSorted((a, b) => b.winRate - a.winRate);
  const byRatingPeak = statsWithCalculations
    .filter((p) => p.ratingPeak !== null)
    .toSorted((a, b) => (b.ratingPeak ?? 0) - (a.ratingPeak ?? 0));

  const tournamentsRanks = getCompetitionRanks(
    byTournaments,
    (p) => p.tournamentsPlayed,
    (p) => p.playerId,
  );
  const gamesRanks = getCompetitionRanks(
    byGames,
    (p) => p.gamesPlayed,
    (p) => p.playerId,
  );
  const winRateRanks = getCompetitionRanks(
    byWinRate,
    (p) => p.winRate,
    (p) => p.playerId,
  );
  const ratingPeakRanks = getCompetitionRanks(
    byRatingPeak,
    (p) => p.ratingPeak ?? 0,
    (p) => p.playerId,
  );

  return statsWithCalculations.map((p) => ({
    playerId: p.playerId,
    tournamentsPlayed: {
      value: p.tournamentsPlayed,
      rank: tournamentsRanks.get(p.playerId) ?? null,
    },
    gamesPlayed: {
      value: p.gamesPlayed,
      rank: gamesRanks.get(p.playerId) ?? null,
    },
    winRate: {
      value: Math.round(p.winRate * 10000) / 100,
      rank: winRateRanks.get(p.playerId) ?? null,
    },
    ratingPeakRank: ratingPeakRanks.get(p.playerId) ?? null,
  }));
}

export async function getCachedClubPlayerStats(
  clubId: string,
): Promise<ClubPlayerStats[]> {
  'use cache';
  if (process.env.NODE_ENV !== 'test') {
    cacheLife({
      stale: 1000 * 60 * 60 * 6,
      revalidate: 1000 * 60 * 60 * 24,
    });
  }
  cacheTag(clubPlayerStatsTag(clubId));
  return await getUncachedClubPlayerStats(clubId);
}

export async function getPlayerStats(
  playerId: string,
): Promise<PlayerStatsModel> {
  const player = await db
    .select({ clubId: players.clubId })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return EMPTY_PLAYER_STATS;

  const clubStats = await getCachedClubPlayerStats(player.clubId);
  return clubStats.find((p) => p.playerId === playerId) ?? EMPTY_PLAYER_STATS;
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
