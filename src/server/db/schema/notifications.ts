import { clubs } from '@/server/db/schema/clubs';
import {
  clubNotificationEvent,
  userNotificationEvent,
} from '@/server/db/schema/enums';
import { users } from '@/server/db/schema/users';
import {
  boolean,
  index,
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
      .defaultNow()
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    event: userNotificationEvent('event').notNull(),
    isSeen: boolean('is_seen').default(false).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('user_notification_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export const club_notifications = pgTable(
  'club_notification',
  {
    id: text('id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    clubId: text('club_id')
      .references(() => clubs.id, { onDelete: 'cascade' })
      .notNull(),
    event: clubNotificationEvent('event').notNull(),
    isSeen: boolean('is_seen').default(false).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('club_notification_club_created_idx').on(
      table.clubId,
      table.createdAt.desc(),
    ),
  ],
);
