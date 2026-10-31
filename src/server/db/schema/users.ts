import { clubs } from '@/server/db/schema/clubs';
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'user',
  {
    id: text('id').notNull(),
    name: text('name'),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    rating: integer('rating'),
    selectedClub: text('selected_club')
      .references(() => clubs.id)
      .notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const sessions = pgTable(
  'user_session',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const apiTokens = pgTable(
  'api_token',
  {
    id: text('id').notNull(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, precision: 3 }),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
