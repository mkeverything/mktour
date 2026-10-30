import { ClubModel } from '@/server/zod/clubs';
import type {
  ClubNotificationEvent,
  UserNotificationEvent,
} from '@/server/zod/enums';
import type {
  ClubNotificationExtendedModel,
  ClubNotificationMetadataMap,
  UserNotificationMetadataMap,
} from '@/server/zod/notifications';
import {
  ClubNotificationModel,
  UserNotificationModel,
} from '@/server/zod/notifications';
import { AffiliationModel, PlayerModel } from '@/server/zod/players';

// typed notifications (database + typed metadata)
type UserNotification<T extends UserNotificationEvent> = Omit<
  UserNotificationModel,
  'event' | 'metadata'
> & {
  event: T;
  metadata: UserNotificationMetadataMap[T];
};

type ClubNotification<T extends ClubNotificationEvent> = Omit<
  ClubNotificationModel,
  'event' | 'metadata'
> & {
  event: T;
  metadata: ClubNotificationMetadataMap[T];
};

// union of all typed notifications
type AnyUserNotification = {
  [K in UserNotificationEvent]: UserNotification<K>;
}[UserNotificationEvent];

type AnyClubNotification = {
  [K in ClubNotificationEvent]: ClubNotification<K>;
}[ClubNotificationEvent];

type AnyNotification = AnyUserNotification | AnyClubNotification;

export type UserNotificationExtended<T extends UserNotificationEvent> = {
  event: T;
  notification: UserNotification<T>;
  metadata: UserNotificationMetadataMap[T];
  affiliation: AffiliationModel | null;
  player: Pick<PlayerModel, 'id' | 'nickname'> | null;
  club: ClubModel | null;
};

export type AnyUserNotificationExtended = {
  [K in UserNotificationEvent]: UserNotificationExtended<K>;
}[UserNotificationEvent];

// Generic typed version that narrows event and metadata from the schema-inferred type
type ClubNotificationExtendedTyped<T extends ClubNotificationEvent> = Omit<
  ClubNotificationExtendedModel,
  'event' | 'metadata'
> & {
  event: T;
  metadata: ClubNotificationMetadataMap[T];
};

export type AnyClubNotificationExtended = {
  [K in ClubNotificationEvent]: ClubNotificationExtendedTyped<K>;
}[ClubNotificationEvent];
