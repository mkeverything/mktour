import { clubs } from '@/server/db/schema/clubs';
import {
  clubNotificationEvent,
  userNotificationEvent,
} from '@/server/db/schema/enums';
import { affiliations, players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import type { StatusInClub } from '@/server/zod/enums';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// each event fills only the references it is about; metadata keeps what the
// event has to show as it was then
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
    affiliationId: text('affiliation_id').references(() => affiliations.id, {
      onDelete: 'cascade',
    }),
    clubId: text('club_id').references(() => clubs.id, {
      onDelete: 'cascade',
    }),
    tournamentId: text('tournament_id').references(() => tournaments.id, {
      onDelete: 'cascade',
    }),
    metadata: jsonb('metadata').$type<{ role: StatusInClub }>(),
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
    affiliationId: text('affiliation_id').references(() => affiliations.id, {
      onDelete: 'cascade',
    }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    playerId: text('player_id').references(() => players.id, {
      onDelete: 'cascade',
    }),
    metadata: jsonb('metadata').$type<{ mergedPlayerNickname: string }>(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('club_notification_club_created_idx').on(
      table.clubId,
      table.createdAt.desc(),
    ),
  ],
);
