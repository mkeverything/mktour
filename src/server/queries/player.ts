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
  isNull,
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

const EMPTY_PLAYER_STATS: PlayerStatsModel = {
  tournamentsPlayed: { value: 0, rank: null },
  gamesPlayed: { value: 0, rank: null },
  winRate: { value: 0, rank: null },
  ratingPeakRank: null,
};

function getCompetitionRanks<T extends { playerId: string }>(
  items: T[],
  getValue: (item: T) => number,
) {
  const ranks = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  items.forEach((item, index) => {
    const value = getValue(item);
    const rank = previousValue === value ? previousRank : index + 1;
    ranks.set(item.playerId, rank);
    previousValue = value;
    previousRank = rank;
  });

  return ranks;
}

function getResultCounts(clubId: string, colour: 'white' | 'black') {
  const unitColumn = colour === 'white' ? games.whiteUnitId : games.blackUnitId;
  const playerColumn =
    colour === 'white' ? games.whitePlayerId : games.blackPlayerId;
  const winResult = colour === 'white' ? '1-0' : '0-1';
  const lossResult = colour === 'white' ? '0-1' : '1-0';

  return db
    .select({
      playerId: players_to_units.playerId,
      wins: count(caseWhen(eq(games.result, winResult), games.id).elseNull()),
      losses: count(
        caseWhen(eq(games.result, lossResult), games.id).elseNull(),
      ),
      draws: count(caseWhen(eq(games.result, '1/2-1/2'), games.id).elseNull()),
    })
    .from(players_to_units)
    .innerJoin(players, eq(players.id, players_to_units.playerId))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .innerJoin(
      games,
      and(
        eq(tournament_units.id, unitColumn),
        or(isNull(playerColumn), eq(playerColumn, players_to_units.playerId)),
      ),
    )
    .where(and(eq(players.clubId, clubId), isNotNull(tournaments.closedAt)))
    .groupBy(players_to_units.playerId);
}

async function getUncachedClubPlayerStats(
  clubId: string,
): Promise<ClubPlayerStats[]> {
  const [participationRows, whiteRows, blackRows] = await Promise.all([
    db
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
      .groupBy(players_to_units.playerId),
    getResultCounts(clubId, 'white'),
    getResultCounts(clubId, 'black'),
  ]);

  const countsByPlayerId = new Map(
    whiteRows.map((row) => [row.playerId, { ...row }]),
  );
  blackRows.forEach((row) => {
    const current = countsByPlayerId.get(row.playerId);
    if (!current) {
      countsByPlayerId.set(row.playerId, { ...row });
      return;
    }
    current.wins += row.wins;
    current.losses += row.losses;
    current.draws += row.draws;
  });

  const statsWithCalculations = participationRows.map((p) => {
    const counts = countsByPlayerId.get(p.playerId);
    const wins = counts?.wins ?? 0;
    const losses = counts?.losses ?? 0;
    const draws = counts?.draws ?? 0;
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
  );
  const gamesRanks = getCompetitionRanks(byGames, (p) => p.gamesPlayed);
  const winRateRanks = getCompetitionRanks(byWinRate, (p) => p.winRate);
  const ratingPeakRanks = getCompetitionRanks(
    byRatingPeak,
    (p) => p.ratingPeak ?? 0,
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

async function getCachedClubPlayerStats(
  clubId: string,
): Promise<ClubPlayerStats[]> {
  'use cache';
  if (process.env.NODE_ENV !== 'test') {
    cacheLife({
      stale: 1000 * 60 * 60 * 6,
      revalidate: 1000 * 60 * 60 * 24,
    });
    cacheTag(clubPlayerStatsTag(clubId));
  }
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
