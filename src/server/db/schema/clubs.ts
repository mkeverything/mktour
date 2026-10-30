import { users } from '@/server/db/schema/users';
import { StatusInClub } from '@/server/zod/enums';
import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const clubs = pgTable(
  'club',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    lichessTeam: text('lichess_team').unique(),
    allowPlayersSetResults: boolean('allow_players_set_results')
      .notNull()
      .default(true),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const clubs_to_users = pgTable(
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
    promotedAt: timestamp('promoted_at', { withTimezone: true, precision: 3 })
      .$default(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
