import { clubs } from '@/server/db/schema/clubs';
import { int, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  rating: int('rating'),
  selectedClub: text('selected_club')
    .references(() => clubs.id)
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const user_preferences = sqliteTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  language: text('language').$default(() => 'en'),
});

export const sessions = sqliteTable('user_session', {
  id: text('id').notNull().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
});

export const apiTokens = sqliteTable('api_token', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});
