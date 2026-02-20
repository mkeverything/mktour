import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { StatusInClub } from '@/server/db/zod/enums';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const clubs = sqliteTable('club', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lichessTeam: text('lichess_team').unique(),
});

export const clubs_to_users = sqliteTable('clubs_to_users', {
  id: text('id').primaryKey(),
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
});

export const clubs_relations = relations(clubs, ({ many }) => ({
  tournaments: many(tournaments),
  players: many(players),
  notifications: many(club_notifications), // user can be involved in many notifications
  affiliations: many(affiliations),
}));
