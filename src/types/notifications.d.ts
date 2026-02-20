import { ClubModel } from '@/server/db/zod/clubs';
import type {
  ClubNotificationEvent,
  StatusInClub,
  UserNotificationEvent,
} from '@/server/db/zod/enums';
import type { ClubNotificationExtendedModel } from '@/server/db/zod/notifications';
import {
  ClubNotificationModel,
  UserNotificationModel,
} from '@/server/db/zod/notifications';
import { AffiliationModel, PlayerModel } from '@/server/db/zod/players';

type UserNotificationMetadata = {
  affiliation_approved: { clubId: string; affiliationId: string };
  affiliation_rejected: { clubId: string; affiliationId: string };
  tournament_won: { tournamentId: string; name: string };
  became_club_manager: { clubId: string; role: StatusInClub };
  removed_from_club_managers: { clubId: string };
};

type ClubNotificationMetadata = {
  affiliation_request: { userId: string; affiliationId: string };
  manager_left: { userId: string };
  affiliation_request_approved: { userId: string; affiliationId: string };
  affiliation_request_rejected: { userId: string; affiliationId: string };
  affiliation_cancelled: { userId: string; affiliationId: string };
};

// typed notifications (database + typed metadata)
type UserNotification<T extends UserNotificationEvent> = Omit<
  UserNotificationModel,
  'event' | 'metadata'
> & {
  event: T;
  metadata: UserNotificationMetadata[T];
};

type ClubNotification<T extends ClubNotificationEvent> = Omit<
  ClubNotificationModel,
  'event' | 'metadata'
> & {
  event: T;
  metadata: ClubNotificationMetadata[T];
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
  metadata: UserNotificationMetadata[T];
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
  metadata: ClubNotificationMetadata[T];
};

export type AnyClubNotificationExtended = {
  [K in ClubNotificationEvent]: ClubNotificationExtendedTyped<K>;
}[ClubNotificationEvent];

// ============================================================================
// websocket message types
// ============================================================================

// generic websocket messages tied to events
interface UserWebSocketMessage<T extends UserNotificationEvent> {
  type: 'user';
  event: T;
  recipientId: string;
}

interface ClubWebSocketMessage<T extends ClubNotificationEvent> {
  type: 'club';
  event: T;
  recipientClubId: string;
}

// additional properties for specific messages
interface AffiliationApprovedWSMessage extends UserWebSocketMessage<'affiliation_approved'> {
  clubId: string;
}

interface AffiliationRejectedWSMessage extends UserWebSocketMessage<'affiliation_rejected'> {
  clubId: string;
}

// union of all websocket messages
type AnyUserWebSocketMessage =
  | UserWebSocketMessage<'removed_from_club_managers'>
  | UserWebSocketMessage<'became_club_manager'>
  | AffiliationApprovedWSMessage
  | AffiliationRejectedWSMessage
  | UserWebSocketMessage<'tournament_won'>;

type AnyClubWebSocketMessage =
  | ClubWebSocketMessage<'affiliation_request'>
  | ClubWebSocketMessage<'manager_left'>
  | ClubWebSocketMessage<'affiliation_request_approved'>
  | ClubWebSocketMessage<'affiliation_request_rejected'>;

// error message
type GlobalErrorMessage = {
  recipientId: string;
  type: 'error';
  event: 'error';
  message: string;
};

// all possible global websocket messages
type GlobalMessage =
  | AnyUserWebSocketMessage
  | AnyClubWebSocketMessage
  | GlobalErrorMessage;
