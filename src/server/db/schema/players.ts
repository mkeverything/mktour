import { clubs } from '@/server/db/schema/clubs';
import {
  games,
  players_to_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { AffiliationStatus } from '@/server/zod/enums';
import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const players = sqliteTable(
  'player',
  {
    id: text('id').primaryKey(),
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
    uniqueIndex('player_nickname_club_unique_idx').on(
      table.nickname,
      table.clubId,
    ),
    uniqueIndex('player_user_club_unique_idx').on(table.userId, table.clubId),
    index('player_club_last_seen_idx').on(table.clubId, table.lastSeenAt),
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
    id: text('id').primaryKey(),
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

// user_id: the user of mktour used with lichess account who initiated the affiliation
// player_id: the actual player being affiliated
export const affiliations = sqliteTable(
  'affiliation',
  {
    id: text('id').primaryKey(),
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
    uniqueIndex('affiliation_user_club_unique_idx').on(
      table.userId,
      table.clubId,
    ),
  ],
);

export const players_relations = relations(players, ({ one, many }) => ({
  club: one(clubs, { fields: [players.clubId], references: [clubs.id] }),
  units: many(players_to_units),
  gamesAsWhite: many(games, { relationName: 'gameWhitePlayer' }),
  gamesAsBlack: many(games, { relationName: 'gameBlackPlayer' }),
}));

export const rating_events_relations = relations(rating_events, ({ one }) => ({
  player: one(players, {
    fields: [rating_events.playerId],
    references: [players.id],
  }),
  sourceTournament: one(tournaments, {
    fields: [rating_events.sourceTournamentId],
    references: [tournaments.id],
  }),
}));

export const affiliations_relations = relations(affiliations, ({ one }) => ({
  user: one(users, {
    fields: [affiliations.userId],
    references: [users.id],
  }),
  club: one(clubs, {
    fields: [affiliations.clubId],
    references: [clubs.id],
  }),
  player: one(players, {
    fields: [affiliations.playerId],
    references: [players.id],
  }),
}));
