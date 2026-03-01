import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import {
  clubNotificationEventEnum,
  userNotificationEventEnum,
} from '@/server/zod/enums';
import {
  affiliationMinimalSchema,
  playersMinimalSchema,
} from '@/server/zod/players';
import { usersSelectMinimalSchema } from '@/server/zod/users';
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

export type UserNotificationMetadataMap = {
  affiliation_approved: { clubId: string; affiliationId: string };
  affiliation_rejected: { clubId: string; affiliationId: string };
  tournament_won: { tournamentId: string; name: string };
  became_club_manager: { clubId: string; role: 'co-owner' | 'admin' };
  removed_from_club_managers: { clubId: string };
};

export type ClubNotificationMetadataMap = {
  affiliation_request: {
    userId: string;
    playerId: string;
    affiliationId: string;
  };
  manager_left: { userId: string };
  affiliation_request_approved: {
    userId: string;
    playerId: string;
    affiliationId: string;
  };
  affiliation_request_rejected: {
    userId: string;
    playerId: string;
  };
  affiliation_cancelled: { userId: string; playerId: string };
};

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
