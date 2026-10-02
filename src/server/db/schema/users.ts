import { clubs } from '@/server/db/schema/clubs';
import {
  int,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'user',
  {
    id: text('id').notNull(),
    name: text('name'),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    rating: int('rating'),
    selectedClub: text('selected_club')
      .references(() => clubs.id)
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const user_preferences = sqliteTable(
  'user_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    language: text('language').$default(() => 'en'),
  },
  (table) => [primaryKey({ columns: [table.userId] })],
);

export const sessions = sqliteTable(
  'user_session',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const apiTokens = sqliteTable(
  'api_token',
  {
    id: text('id').notNull(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
