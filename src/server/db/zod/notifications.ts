import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import {
  clubNotificationEventEnum,
  userNotificationEventEnum,
} from '@/server/db/zod/enums';
import {
  affiliationMinimalSchema,
  playersMinimalSchema,
} from '@/server/db/zod/players';
import { usersSelectMinimalSchema } from '@/server/db/zod/users';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import z from 'zod';

export const userNotificationsSelectSchema =
  createSelectSchema(user_notifications);
export const clubNotificationsSelectSchema = createSelectSchema(
  club_notifications,
  {
    event: clubNotificationEventEnum,
  },
);
export const userNotificationsInsertSchema = createInsertSchema(
  user_notifications,
  {
    event: userNotificationEventEnum,
  },
);
export const clubNotificationsInsertSchema = createInsertSchema(
  club_notifications,
  {
    event: clubNotificationEventEnum,
  },
);
export const userNotificationsUpdateSchema =
  createUpdateSchema(user_notifications);
export const clubNotificationsUpdateSchema =
  createUpdateSchema(club_notifications);

export const clubNotificationExtendedSchema =
  clubNotificationsSelectSchema.extend({
    affiliation: affiliationMinimalSchema.nullable(),
    user: usersSelectMinimalSchema.nullable(),
    player: playersMinimalSchema.nullable(),
  });

export type ClubNotificationExtendedModel = z.infer<
  typeof clubNotificationExtendedSchema
>;

export type UserNotificationModel = z.infer<
  typeof userNotificationsSelectSchema
>;
export type UserNotificationInsertModel = z.infer<
  typeof userNotificationsInsertSchema
>;
export type UserNotificationUpdateModel = z.infer<
  typeof userNotificationsUpdateSchema
>;

export type ClubNotificationModel = z.infer<
  typeof clubNotificationsSelectSchema
>;
export type ClubNotificationInsertModel = z.infer<
  typeof clubNotificationsInsertSchema
>;
export type ClubNotificationUpdateModel = z.infer<
  typeof clubNotificationsUpdateSchema
>;
