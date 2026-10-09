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
  getColumns,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

type Database = Pick<typeof db, 'select'>;
type Tx = Pick<typeof db, 'select' | 'insert'>;

const { gamesPlayed: _, ...STORED_COLUMNS } = getColumns(player_stats);
const STORED_KEYS = Object.keys(STORED_COLUMNS) as (keyof PlayerStatsRow)[];

const RATING_COLUMNS = {
  rating: players.rating,
  ratingDeviation: players.ratingDeviation,
  ratingVolatility: players.ratingVolatility,
  ratingLastUpdateAt: players.ratingLastUpdateAt,
};

const UPSERT_SET = Object.fromEntries(
  Object.entries(STORED_COLUMNS)
    .filter(([key]) => key !== 'playerId' && key !== 'clubId')
    .map(([key, column]) => [key, sql.raw(`excluded.${column.name}`)]),
);

// 11 bound parameters per row keeps every statement far below sqlite's variable limit
const UPSERT_CHUNK_SIZE = 500;

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
type RankingPlayer = PlayerStatsCounts &
  Pick<PlayerRecordModel, keyof typeof RATING_COLUMNS> & { playerId: string };

const ZERO_COUNTS: PlayerStatsCounts = {
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  gamesWon: 0,
  gamesDrawn: 0,
  gamesLost: 0,
};

const toPlayerStatsRow = (row: PlayerStatsRow) =>
  Object.fromEntries(
    STORED_KEYS.map((key) => [key, row[key]]),
  ) as PlayerStatsRow;

const compareByRating = (a: RankingPlayer, b: RankingPlayer) =>
  b.rating - a.rating ||
  a.ratingDeviation - b.ratingDeviation ||
  (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);

/** assigns unique club positions; ties fall back to rating, stored rd, then id */
export function rankClubPlayers<T extends RankingPlayer>(
  clubPlayers: T[],
  now: Date,
) {
  const positions = (
    isEligible: (player: T) => boolean,
    metric: (player: T) => number = () => 0,
  ) => {
    const sorted = clubPlayers
      .filter(isEligible)
      .toSorted((a, b) => metric(b) - metric(a) || compareByRating(a, b));
    return new Map(sorted.map((player, i) => [player.playerId, i + 1]));
  };
  const byMetric = (metric: (player: T) => number) =>
    positions((player) => metric(player) > 0, metric);

  const rating = positions((player) =>
    isEstablishedRating(getCurrentRatingDeviation(player, now)),
  );
  const tournamentsPlayed = byMetric((player) => player.tournamentsPlayed);
  const tournamentsWon = byMetric((player) => player.tournamentsWon);
  const gamesPlayed = byMetric(
    (player) => player.gamesWon + player.gamesDrawn + player.gamesLost,
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
        ...RATING_COLUMNS,
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
      .select({ ...STORED_COLUMNS, ...RATING_COLUMNS })
      .from(player_stats)
      .innerJoin(players, eq(players.id, player_stats.playerId))
      .where(eq(player_stats.clubId, clubId)),
    playerIds.length > 0
      ? getPlayerStatsCounts(tx, inArray(players_to_units.playerId, playerIds))
      : new Map<string, PlayerStatsCounts>(),
  ]);

  const affected = new Set(playerIds);
  const changedRows = rankClubPlayers(
    storedRows.map((row) =>
      affected.has(row.playerId)
        ? { ...row, ...(counts.get(row.playerId) ?? ZERO_COUNTS) }
        : row,
    ),
    now,
  )
    .filter((row, i) =>
      STORED_KEYS.some((key) => row[key] !== storedRows[i][key]),
    )
    .map(toPlayerStatsRow);

  for (let i = 0; i < changedRows.length; i += UPSERT_CHUNK_SIZE) {
    await tx
      .insert(player_stats)
      .values(changedRows.slice(i, i + UPSERT_CHUNK_SIZE))
      .onConflictDoUpdate({ target: player_stats.playerId, set: UPSERT_SET });
  }
}
