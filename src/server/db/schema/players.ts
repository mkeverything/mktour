import { lower } from '@/lib/sql-lower';
import { clubs } from '@/server/db/schema/clubs';
import { affiliationStatus } from '@/server/db/schema/enums';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { openAffiliationStatusEnum } from '@/server/zod/enums';
import { inArray, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const players = pgTable(
  'player',
  {
    id: text('id').notNull(),
    nickname: text('nickname').notNull(),
    realname: text('realname'),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    rating: integer('rating').notNull().default(1500),
    ratingPeak: integer('rating_peak'),
    ratingDeviation: doublePrecision('rating_deviation').notNull().default(350),
    ratingVolatility: doublePrecision('rating_volatility')
      .notNull()
      .default(0.06),
    ratingLastUpdateAt: timestamp('rating_last_update_at', {
      withTimezone: true,
      precision: 3,
    })
      .notNull()
      .defaultNow(),
    clubId: text('club_id')
      .references(() => clubs.id, { onDelete: 'cascade' })
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(), // equals closed_at() last tournament they participated
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('player_club_nickname_unique_idx').on(
      table.clubId,
      lower(table.nickname),
    ),
    uniqueIndex('player_user_club_unique_idx').on(table.userId, table.clubId),
    index('player_club_last_seen_idx').on(table.clubId, table.lastSeenAt),
    index('player_club_rating_idx').on(
      table.clubId,
      table.rating.desc(),
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
export const rating_events = pgTable(
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
    publishedAt: timestamp('published_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    rating: integer('rating').notNull(),
    ratingDeviation: doublePrecision('rating_deviation').notNull(),
    isStarting: boolean('is_starting').notNull(),
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
    index('rating_event_source_tournament_idx').on(table.sourceTournamentId),
    uniqueIndex('rating_event_player_starting_unique_idx')
      .on(table.playerId)
      .where(sql`${table.isStarting}`),
    check(
      'rating_event_rating_bounds',
      sql`${table.rating} between 400 and 3400`,
    ),
    check(
      'rating_event_starting_has_no_source',
      sql`not ${table.isStarting} or ${table.sourceTournamentId} is null`,
    ),
  ],
);

// read projection of finished-tournament history, refreshed in the same
// transaction as every event that changes it. ranks are unique 1-based positions
// of every club player as of the last re-rank (docs/adr/0002); null means the
// player was created after it.
export const player_stats = pgTable(
  'player_stats',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    tournamentsPlayed: integer('tournaments_played').notNull().default(0),
    tournamentsWon: integer('tournaments_won').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    gamesDrawn: integer('games_drawn').notNull().default(0),
    gamesLost: integer('games_lost').notNull().default(0),
    gamesPlayed: integer('games_played')
      .notNull()
      .generatedAlwaysAs(sql`games_won + games_drawn + games_lost`),
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
  ],
);

// user_id: the user of mktour used with lichess account who initiated the affiliation
// player_id: the actual player being affiliated
// each row is one request and its outcome: a closed row never changes, and a
// new request is a new row
export const affiliations = pgTable(
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
    status: affiliationStatus('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('affiliation_open_user_club_unique_idx')
      .on(table.userId, table.clubId)
      .where(inArray(table.status, openAffiliationStatusEnum.options)),
    uniqueIndex('affiliation_open_player_unique_idx')
      .on(table.playerId)
      .where(inArray(table.status, openAffiliationStatusEnum.options)),
  ],
);
