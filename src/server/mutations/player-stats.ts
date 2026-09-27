import { getCurrentRatingDeviation, isEstablishedRating } from '@/lib/glicko2';
import { caseWhen } from '@/lib/sql-case-when';
import type { db } from '@/server/db';
import { player_stats, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import type { PlayerRecordModel } from '@/server/zod/players';
import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

type Database = Pick<typeof db, 'select'>;
type Tx = Pick<typeof db, 'select' | 'insert'>;

export type PlayerStatsRow = Omit<
  typeof player_stats.$inferSelect,
  'gamesPlayed'
>;
type PlayerStatsCounts = Pick<
  PlayerStatsRow,
  | 'tournamentsPlayed'
  | 'tournamentsWon'
  | 'gamesWon'
  | 'gamesDrawn'
  | 'gamesLost'
>;
type PlayerStatsRanks = Pick<
  PlayerStatsRow,
  | 'ratingRank'
  | 'tournamentsPlayedRank'
  | 'tournamentsWonRank'
  | 'gamesPlayedRank'
>;
type RankingPlayer = PlayerStatsCounts & {
  playerId: PlayerRecordModel['id'];
} & Pick<
    PlayerRecordModel,
    'rating' | 'ratingDeviation' | 'ratingVolatility' | 'ratingLastUpdateAt'
  >;

const ZERO_COUNTS: PlayerStatsCounts = {
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  gamesWon: 0,
  gamesDrawn: 0,
  gamesLost: 0,
};

const PROJECTED_KEYS = [
  'tournamentsPlayed',
  'tournamentsWon',
  'gamesWon',
  'gamesDrawn',
  'gamesLost',
  'ratingRank',
  'tournamentsPlayedRank',
  'tournamentsWonRank',
  'gamesPlayedRank',
] as const satisfies (keyof PlayerStatsRow)[];

// 11 bound parameters per row keeps every statement far below sqlite's variable limit
const UPSERT_CHUNK_SIZE = 500;

const gamesPlayedOf = (player: PlayerStatsCounts) =>
  player.gamesWon + player.gamesDrawn + player.gamesLost;

const compareByRating = (a: RankingPlayer, b: RankingPlayer) =>
  b.rating - a.rating ||
  a.ratingDeviation - b.ratingDeviation ||
  (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);

function getPositions(
  eligible: RankingPlayer[],
  metric?: (player: RankingPlayer) => number,
) {
  const sorted = eligible.toSorted(
    (a, b) => (metric ? metric(b) - metric(a) : 0) || compareByRating(a, b),
  );
  return new Map(sorted.map((player, i) => [player.playerId, i + 1]));
}

/** assigns unique club positions; ties fall back to rating, stored rd, then id */
export function rankClubPlayers<T extends RankingPlayer>(
  clubPlayers: T[],
  now: Date,
): (T & PlayerStatsRanks)[] {
  const rating = getPositions(
    clubPlayers.filter((player) =>
      isEstablishedRating(getCurrentRatingDeviation(player, now)),
    ),
  );
  const tournamentsPlayed = getPositions(
    clubPlayers.filter((player) => player.tournamentsPlayed > 0),
    (player) => player.tournamentsPlayed,
  );
  const tournamentsWon = getPositions(
    clubPlayers.filter((player) => player.tournamentsWon > 0),
    (player) => player.tournamentsWon,
  );
  const gamesPlayed = getPositions(
    clubPlayers.filter((player) => gamesPlayedOf(player) > 0),
    gamesPlayedOf,
  );

  return clubPlayers.map((player) => ({
    ...player,
    ratingRank: rating.get(player.playerId) ?? null,
    tournamentsPlayedRank: tournamentsPlayed.get(player.playerId) ?? null,
    tournamentsWonRank: tournamentsWon.get(player.playerId) ?? null,
    gamesPlayedRank: gamesPlayed.get(player.playerId) ?? null,
  }));
}

function getResultCounts(
  database: Database,
  where: SQL | undefined,
  colour: 'white' | 'black',
) {
  const unitColumn = colour === 'white' ? games.whiteUnitId : games.blackUnitId;
  const playerColumn =
    colour === 'white' ? games.whitePlayerId : games.blackPlayerId;
  const winResult = colour === 'white' ? '1-0' : '0-1';
  const lossResult = colour === 'white' ? '0-1' : '1-0';

  return database
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
    .where(where)
    .groupBy(players_to_units.playerId);
}

/** finished-tournament counts for the players matched by `where`; players without history are absent */
async function getPlayerStatsCounts(database: Database, where: SQL) {
  const closed = and(where, isNotNull(tournaments.closedAt));
  const [participationRows, whiteRows, blackRows] = await Promise.all([
    database
      .select({
        playerId: players_to_units.playerId,
        tournamentsPlayed: countDistinct(tournaments.id),
        tournamentsWon: countDistinct(
          caseWhen(eq(tournament_units.place, 1), tournaments.id).elseNull(),
        ),
      })
      .from(players_to_units)
      .innerJoin(players, eq(players.id, players_to_units.playerId))
      .innerJoin(
        tournament_units,
        eq(players_to_units.unitId, tournament_units.id),
      )
      .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
      .where(closed)
      .groupBy(players_to_units.playerId),
    getResultCounts(database, closed, 'white'),
    getResultCounts(database, closed, 'black'),
  ]);

  const counts = new Map<string, PlayerStatsCounts>(
    participationRows.map(({ playerId, ...participation }) => [
      playerId,
      { ...ZERO_COUNTS, ...participation },
    ]),
  );
  for (const row of [...whiteRows, ...blackRows]) {
    const current = counts.get(row.playerId);
    if (!current) continue;
    current.gamesWon += row.wins;
    current.gamesDrawn += row.draws;
    current.gamesLost += row.losses;
  }
  return counts;
}

/** full projection rows for every club player, computed from source tables only */
export async function buildClubPlayerStats(
  database: Database,
  clubId: string,
  now: Date,
): Promise<PlayerStatsRow[]> {
  const [clubPlayers, counts] = await Promise.all([
    database
      .select({
        playerId: players.id,
        clubId: players.clubId,
        rating: players.rating,
        ratingDeviation: players.ratingDeviation,
        ratingVolatility: players.ratingVolatility,
        ratingLastUpdateAt: players.ratingLastUpdateAt,
      })
      .from(players)
      .where(eq(players.clubId, clubId)),
    getPlayerStatsCounts(database, eq(players.clubId, clubId)),
  ]);

  return rankClubPlayers(
    clubPlayers.map((player) => ({
      ...player,
      ...(counts.get(player.playerId) ?? ZERO_COUNTS),
    })),
    now,
  ).map(toPlayerStatsRow);
}

/**
 * recomputes counts for `playerIds` from source tables, then re-ranks the whole
 * club and writes only the rows that changed. must run inside the transaction
 * of the event that changed the source data.
 */
export async function refreshPlayerStats(
  tx: Tx,
  {
    clubId,
    playerIds,
    now,
  }: { clubId: string; playerIds: string[]; now: Date },
) {
  const [storedRows, counts] = await Promise.all([
    tx
      .select({
        playerId: player_stats.playerId,
        clubId: player_stats.clubId,
        tournamentsPlayed: player_stats.tournamentsPlayed,
        tournamentsWon: player_stats.tournamentsWon,
        gamesWon: player_stats.gamesWon,
        gamesDrawn: player_stats.gamesDrawn,
        gamesLost: player_stats.gamesLost,
        ratingRank: player_stats.ratingRank,
        tournamentsPlayedRank: player_stats.tournamentsPlayedRank,
        tournamentsWonRank: player_stats.tournamentsWonRank,
        gamesPlayedRank: player_stats.gamesPlayedRank,
        rating: players.rating,
        ratingDeviation: players.ratingDeviation,
        ratingVolatility: players.ratingVolatility,
        ratingLastUpdateAt: players.ratingLastUpdateAt,
      })
      .from(player_stats)
      .innerJoin(players, eq(players.id, player_stats.playerId))
      .where(eq(player_stats.clubId, clubId)),
    playerIds.length > 0
      ? getPlayerStatsCounts(tx, inArray(players_to_units.playerId, playerIds))
      : new Map<string, PlayerStatsCounts>(),
  ]);

  const affected = new Set(playerIds);
  const rankedRows = rankClubPlayers(
    storedRows.map((row) =>
      affected.has(row.playerId)
        ? { ...row, ...(counts.get(row.playerId) ?? ZERO_COUNTS) }
        : row,
    ),
    now,
  );
  const changedRows = rankedRows
    .filter((row, i) =>
      PROJECTED_KEYS.some((key) => row[key] !== storedRows[i][key]),
    )
    .map(toPlayerStatsRow);

  for (let i = 0; i < changedRows.length; i += UPSERT_CHUNK_SIZE) {
    await tx
      .insert(player_stats)
      .values(changedRows.slice(i, i + UPSERT_CHUNK_SIZE))
      .onConflictDoUpdate({
        target: player_stats.playerId,
        set: {
          tournamentsPlayed: sql`excluded.tournaments_played`,
          tournamentsWon: sql`excluded.tournaments_won`,
          gamesWon: sql`excluded.games_won`,
          gamesDrawn: sql`excluded.games_drawn`,
          gamesLost: sql`excluded.games_lost`,
          ratingRank: sql`excluded.rating_rank`,
          tournamentsPlayedRank: sql`excluded.tournaments_played_rank`,
          tournamentsWonRank: sql`excluded.tournaments_won_rank`,
          gamesPlayedRank: sql`excluded.games_played_rank`,
        },
      });
  }
}

function toPlayerStatsRow(row: PlayerStatsRow): PlayerStatsRow {
  return {
    playerId: row.playerId,
    clubId: row.clubId,
    tournamentsPlayed: row.tournamentsPlayed,
    tournamentsWon: row.tournamentsWon,
    gamesWon: row.gamesWon,
    gamesDrawn: row.gamesDrawn,
    gamesLost: row.gamesLost,
    ratingRank: row.ratingRank,
    tournamentsPlayedRank: row.tournamentsPlayedRank,
    tournamentsWonRank: row.tournamentsWonRank,
    gamesPlayedRank: row.gamesPlayedRank,
  };
}
