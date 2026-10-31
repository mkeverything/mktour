import { statusInClub } from '@/server/db/schema/enums';
import { users } from '@/server/db/schema/users';
import {
  boolean,
  index,
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
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: statusInClub('status').notNull(),
    promotedAt: timestamp('promoted_at', { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clubId, table.userId] }),
    index('clubs_to_users_user_idx').on(table.userId),
  ],
);
