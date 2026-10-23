import { users } from '@/server/db/schema/users';
import { StatusInClub } from '@/server/zod/enums';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const clubs = sqliteTable(
  'club',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    lichessTeam: text('lichess_team').unique(),
    allowPlayersSetResults: integer('allow_players_set_results', {
      mode: 'boolean',
    })
      .notNull()
      .default(true),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const clubs_to_users = sqliteTable(
  'clubs_to_users',
  {
    id: text('id').notNull(),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().$type<StatusInClub>(),
    promotedAt: integer('promoted_at', { mode: 'timestamp' })
      .$default(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
