import { clubs } from '@/server/db/schema/clubs';
import { users } from '@/server/db/schema/users';
import {
  ClubNotificationEvent,
  UserNotificationEvent,
} from '@/server/db/zod/enums';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user_notifications = sqliteTable('user_notification', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$default(() => new Date())
    .notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  event: text('event').$type<UserNotificationEvent>().notNull(),
  isSeen: integer('is_seen', { mode: 'boolean' })
    .$default(() => false)
    .notNull(),
  metadata: text('metadata', {
    mode: 'json',
  })
    .$type<Record<string, unknown>>()
    .notNull()
    .$default(() => ({ test: 'test' })),
});

export const club_notifications = sqliteTable('club_notification', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$default(() => new Date())
    .notNull(),
  clubId: text('club_id')
    .references(() => clubs.id, { onDelete: 'cascade' })
    .notNull(),
  event: text('event').$type<ClubNotificationEvent>().notNull(),
  isSeen: integer('is_seen', { mode: 'boolean' })
    .$default(() => false)
    .notNull(),
  metadata: text('metadata', {
    mode: 'json',
  })
    .$type<Record<string, unknown>>()
    .notNull()
    .$default(() => ({ test: 'test' })),
});

export const user_notifications_relations = relations(
  user_notifications,
  ({ one }) => ({
    user: one(users, {
      fields: [user_notifications.userId],
      references: [users.id],
    }),
  }),
);

export const club_notifications_relations = relations(
  club_notifications,
  ({ one }) => ({
    club: one(clubs, {
      fields: [club_notifications.clubId],
      references: [clubs.id],
    }),
  }),
);
