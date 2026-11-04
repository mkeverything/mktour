import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import { clubsSelectSchema } from '@/server/zod/clubs';
import { statusInClubEnum } from '@/server/zod/enums';
import {
  playerOutputSchema,
  playerPublicSchema,
  playersMinimalSchema,
} from '@/server/zod/players';
import { tournamentSchema } from '@/server/zod/tournaments';
import { usersSelectMinimalSchema } from '@/server/zod/users';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

const userNotificationRefinements = {
  metadata: () => z.object({ role: statusInClubEnum }),
};
const clubNotificationRefinements = {
  metadata: () => z.object({ mergedPlayerNickname: z.string() }),
};

export const userNotificationsSelectSchema = createSelectSchema(
  user_notifications,
  userNotificationRefinements,
);
export const clubNotificationsSelectSchema = createSelectSchema(
  club_notifications,
  clubNotificationRefinements,
);
export const userNotificationsInsertSchema = createInsertSchema(
  user_notifications,
  userNotificationRefinements,
);
export const clubNotificationsInsertSchema = createInsertSchema(
  club_notifications,
  clubNotificationRefinements,
);

export const userNotificationExtendedSchema = z.object({
  notification: userNotificationsSelectSchema,
  player: playerPublicSchema.pick({ id: true, nickname: true }).nullable(),
  club: clubsSelectSchema.nullable(),
  tournament: tournamentSchema.pick({ id: true, title: true }).nullable(),
});

export const clubNotificationExtendedSchema =
  clubNotificationsSelectSchema.extend({
    user: usersSelectMinimalSchema.nullable(),
    player: playerOutputSchema
      .transform(({ clubId, ...player }) => player)
      .pipe(playersMinimalSchema)
      .nullable(),
  });

export const userNotificationsOutputSchema = z.object({
  notifications: z.array(userNotificationExtendedSchema),
  nextCursor: z.number().nullable(),
});

export const clubInboxCounterSchema = z.object({
  requests: z.number(),
  notifications: z.number(),
});

export type UserNotificationInsertModel = z.infer<
  typeof userNotificationsInsertSchema
>;
export type UserNotificationExtendedModel = z.infer<
  typeof userNotificationExtendedSchema
>;

export type ClubNotificationInsertModel = z.infer<
  typeof clubNotificationsInsertSchema
>;
export type ClubNotificationExtendedModel = z.infer<
  typeof clubNotificationExtendedSchema
>;
