import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { AffiliationStatus } from '@/server/zod/enums';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const players = sqliteTable(
  'player',
  {
    id: text('id').notNull(),
    nickname: text('nickname').notNull(),
    realname: text('realname'),
    userId: text('user_id').references(() => users.id),
    rating: integer('rating').notNull().default(1500),
    ratingPeak: integer('rating_peak'),
    ratingDeviation: real('rating_deviation').notNull().default(350),
    ratingVolatility: real('rating_volatility').notNull().default(0.06),
    ratingLastUpdateAt: integer('rating_last_update_at', {
      mode: 'timestamp',
    })
      .notNull()
      .$default(() => new Date()),
    clubId: text('club_id')
      .references(() => clubs.id)
      .notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' })
      .$default(() => new Date())
      .notNull(), // equals closed_at() last tournament they participated
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('player_nickname_club_unique_idx').on(
      table.nickname,
      table.clubId,
    ),
    uniqueIndex('player_user_club_unique_idx').on(table.userId, table.clubId),
    uniqueIndex('player_id_club_unique_idx').on(table.id, table.clubId),
    index('player_club_last_seen_idx').on(table.clubId, table.lastSeenAt),
    index('player_club_rating_idx').on(
      table.clubId,
      sql`${table.rating} desc`,
      table.ratingDeviation,
      table.id,
    ),
    check('player_rating_bounds', sql`${table.rating} between 400 and 3400`),
    check(
      'player_rating_peak_bounds',
      sql`${table.ratingPeak} is null or ${table.ratingPeak} between 400 and 3400`,
    ),
  ],
);

// a player's published rating history: one starting row, then one row per
// rated tournament closure. rows are never recalculated; deleting the source
// tournament only detaches the reference.
export const rating_events = sqliteTable(
  'rating_event',
  {
    id: text('id').notNull(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    sourceTournamentId: text('source_tournament_id').references(
      () => tournaments.id,
      { onDelete: 'set null' },
    ),
    publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
    rating: integer('rating').notNull(),
    ratingDeviation: real('rating_deviation').notNull(),
    isStarting: integer('is_starting', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('rating_event_player_timeline_idx').on(
      table.playerId,
      table.publishedAt,
      table.id,
    ),
    uniqueIndex('rating_event_player_tournament_unique_idx').on(
      table.playerId,
      table.sourceTournamentId,
    ),
    uniqueIndex('rating_event_player_starting_unique_idx')
      .on(table.playerId)
      .where(sql`${table.isStarting} = 1`),
    check(
      'rating_event_rating_bounds',
      sql`${table.rating} between 400 and 3400`,
    ),
    check(
      'rating_event_starting_has_no_source',
      sql`${table.isStarting} = 0 or ${table.sourceTournamentId} is null`,
    ),
  ],
);

// read projection of finished-tournament history, refreshed in the same
// transaction as every event that changes it. ranks are unique 1-based positions
// among eligible club players; null means unranked.
export const player_stats = sqliteTable(
  'player_stats',
  {
    playerId: text('player_id').notNull(),
    clubId: text('club_id').notNull(),
    tournamentsPlayed: integer('tournaments_played').notNull().default(0),
    tournamentsWon: integer('tournaments_won').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    gamesDrawn: integer('games_drawn').notNull().default(0),
    gamesLost: integer('games_lost').notNull().default(0),
    gamesPlayed: integer('games_played')
      .notNull()
      .generatedAlwaysAs(sql`games_won + games_drawn + games_lost`, {
        mode: 'stored',
      }),
    ratingRank: integer('rating_rank'),
    tournamentsPlayedRank: integer('tournaments_played_rank'),
    tournamentsWonRank: integer('tournaments_won_rank'),
    gamesPlayedRank: integer('games_played_rank'),
  },
  (table) => [
    primaryKey({ columns: [table.playerId] }),
    check(
      'player_stats_counts_non_negative',
      sql`${table.tournamentsPlayed} >= 0 and ${table.tournamentsWon} >= 0 and ${table.gamesWon} >= 0 and ${table.gamesDrawn} >= 0 and ${table.gamesLost} >= 0`,
    ),
    check(
      'player_stats_tournament_wins_lte_played',
      sql`${table.tournamentsWon} <= ${table.tournamentsPlayed}`,
    ),
    check(
      'player_stats_ranks_positive',
      sql`(${table.ratingRank} is null or ${table.ratingRank} >= 1) and (${table.tournamentsPlayedRank} is null or ${table.tournamentsPlayedRank} >= 1) and (${table.tournamentsWonRank} is null or ${table.tournamentsWonRank} >= 1) and (${table.gamesPlayedRank} is null or ${table.gamesPlayedRank} >= 1)`,
    ),
    foreignKey({
      columns: [table.playerId, table.clubId],
      foreignColumns: [players.id, players.clubId],
      name: 'player_stats_player_club_fk',
    }).onDelete('cascade'),
    index('player_stats_club_rating_rank_idx').on(
      table.clubId,
      table.ratingRank,
    ),
    index('player_stats_club_tournaments_played_rank_idx').on(
      table.clubId,
      table.tournamentsPlayedRank,
    ),
    index('player_stats_club_tournaments_won_rank_idx').on(
      table.clubId,
      table.tournamentsWonRank,
    ),
    index('player_stats_club_games_played_rank_idx').on(
      table.clubId,
      table.gamesPlayedRank,
    ),
  ],
);

// user_id: the user of mktour used with lichess account who initiated the affiliation
// player_id: the actual player being affiliated
export const affiliations = sqliteTable(
  'affiliation',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    clubId: text('club_id')
      .references(() => clubs.id, { onDelete: 'cascade' })
      .notNull(),
    playerId: text('player_id')
      .references(() => players.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').$type<AffiliationStatus>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$default(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$default(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('affiliation_user_club_unique_idx').on(
      table.userId,
      table.clubId,
    ),
  ],
);
