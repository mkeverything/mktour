import { caseWhen } from '@/lib/sql-case-when';
import { lower } from '@/lib/sql-lower';
import { rowNumber, type Ordering } from '@/lib/sql-order';
import type { Transaction } from '@/server/db';
import { lockClubs } from '@/server/db/locks';
import { player_stats, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import type { PlayerStatsRowModel } from '@/server/zod/players';
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

const RATING_ORDER: Ordering = [
  [players.rating, 'desc'],
  [players.ratingDeviation, 'asc'],
  [players.lastSeenAt, 'desc'],
  [lower(players.nickname), 'asc'],
];

/** ranks number club players along these orders; the club list sorts by the same ones */
export const RANK_ORDERS = {
  ratingRank: RATING_ORDER,
  tournamentsPlayedRank: [
    [player_stats.tournamentsPlayed, 'desc'],
    ...RATING_ORDER,
  ],
  tournamentsWonRank: [[player_stats.tournamentsWon, 'desc'], ...RATING_ORDER],
  gamesPlayedRank: [[player_stats.gamesPlayed, 'desc'], ...RATING_ORDER],
} satisfies Record<string, Ordering>;

type PlayerStatsCounts = Pick<
  PlayerStatsRowModel,
  | 'tournamentsPlayed'
  | 'tournamentsWon'
  | 'gamesWon'
  | 'gamesDrawn'
  | 'gamesLost'
>;

const ZERO_COUNTS: PlayerStatsCounts = {
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  gamesWon: 0,
  gamesDrawn: 0,
  gamesLost: 0,
};

/**
 * recounts `playerIds` from finished tournaments and re-ranks their club. runs in
 * the transaction of the event that changed their results
 */
export async function refreshPlayerStats(
  tx: Transaction,
  { clubId, playerIds }: { clubId: string; playerIds: string[] },
) {
  await lockClubs(tx, [clubId]);
  await updateCounts(tx, playerIds);
  await rankClub(tx, clubId);
}

async function updateCounts(tx: Transaction, playerIds: string[]) {
  if (playerIds.length === 0) return;
  const counts = await getPlayerStatsCounts(tx, playerIds);
  for (const playerId of playerIds) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await tx
      .update(player_stats)
      .set(counts.get(playerId) ?? ZERO_COUNTS)
      .where(eq(player_stats.playerId, playerId));
  }
}

async function rankClub(tx: Transaction, clubId: string) {
  const ranked = tx
    .select({
      playerId: player_stats.playerId,
      ratingRank: rowNumber(RANK_ORDERS.ratingRank).as('rating_rank'),
      tournamentsPlayedRank: rowNumber(RANK_ORDERS.tournamentsPlayedRank).as(
        'tournaments_played_rank',
      ),
      tournamentsWonRank: rowNumber(RANK_ORDERS.tournamentsWonRank).as(
        'tournaments_won_rank',
      ),
      gamesPlayedRank: rowNumber(RANK_ORDERS.gamesPlayedRank).as(
        'games_played_rank',
      ),
    })
    .from(player_stats)
    .innerJoin(players, eq(players.id, player_stats.playerId))
    .where(eq(player_stats.clubId, clubId))
    .as('ranked');
  await tx
    .update(player_stats)
    .set({
      ratingRank: sql`${ranked.ratingRank}`,
      tournamentsPlayedRank: sql`${ranked.tournamentsPlayedRank}`,
      tournamentsWonRank: sql`${ranked.tournamentsWonRank}`,
      gamesPlayedRank: sql`${ranked.gamesPlayedRank}`,
    })
    .from(ranked)
    .where(eq(player_stats.playerId, ranked.playerId));
}

function getResultCounts(
  tx: Transaction,
  where: SQL | undefined,
  colour: 'white' | 'black',
) {
  const unitColumn = colour === 'white' ? games.whiteUnitId : games.blackUnitId;
  const playerColumn =
    colour === 'white' ? games.whitePlayerId : games.blackPlayerId;
  const winResult = colour === 'white' ? '1-0' : '0-1';
  const lossResult = colour === 'white' ? '0-1' : '1-0';

  return tx
    .select({
      playerId: players_to_units.playerId,
      wins: count(caseWhen(eq(games.result, winResult), games.id).elseNull()),
      losses: count(
        caseWhen(eq(games.result, lossResult), games.id).elseNull(),
      ),
      draws: count(caseWhen(eq(games.result, '1/2-1/2'), games.id).elseNull()),
    })
    .from(players_to_units)
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

/** finished-tournament counts of `playerIds`; players without history are absent */
async function getPlayerStatsCounts(tx: Transaction, playerIds: string[]) {
  const closed = and(
    inArray(players_to_units.playerId, playerIds),
    isNotNull(tournaments.closedAt),
  );
  // react-doctor-disable-next-line react-doctor/async-parallel
  const participationRows = await tx
    .select({
      playerId: players_to_units.playerId,
      tournamentsPlayed: countDistinct(tournaments.id),
      tournamentsWon: countDistinct(
        caseWhen(eq(tournament_units.place, 1), tournaments.id).elseNull(),
      ),
    })
    .from(players_to_units)
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .where(closed)
    .groupBy(players_to_units.playerId);
  // react-doctor-disable-next-line react-doctor/server-sequential-independent-await
  const whiteRows = await getResultCounts(tx, closed, 'white');
  const blackRows = await getResultCounts(tx, closed, 'black');

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
