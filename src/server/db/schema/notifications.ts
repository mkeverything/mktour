import { clubs } from '@/server/db/schema/clubs';
import { users } from '@/server/db/schema/users';
import {
  ClubNotificationEvent,
  UserNotificationEvent,
} from '@/server/zod/enums';
import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const user_notifications = pgTable(
  'user_notification',
  {
    id: text('id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .$default(() => new Date())
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    event: text('event').$type<UserNotificationEvent>().notNull(),
    isSeen: boolean('is_seen')
      .$default(() => false)
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .$default(() => ({ test: 'test' })),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const club_notifications = pgTable(
  'club_notification',
  {
    id: text('id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .$default(() => new Date())
      .notNull(),
    clubId: text('club_id')
      .references(() => clubs.id, { onDelete: 'cascade' })
      .notNull(),
    event: text('event').$type<ClubNotificationEvent>().notNull(),
    isSeen: boolean('is_seen')
      .$default(() => false)
      .notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .$default(() => ({ test: 'test' })),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
