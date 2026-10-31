import {
  affiliationStatusEnum,
  clubNotificationEventEnum,
  gameResultEnum,
  roundNameEnum,
  statusInClubEnum,
  tournamentFormatEnum,
  tournamentTypeEnum,
  userNotificationEventEnum,
} from '@/server/zod/enums';
import { pgEnum } from 'drizzle-orm/pg-core';

// pgEnum needs a non-empty tuple, and drizzle's zod schemas only narrow enums
// built from one; zod keeps its options as a plain array
const valuesOf = <T extends string>(options: readonly T[]) =>
  options as [T, ...T[]];

export const affiliationStatus = pgEnum(
  'affiliation_status',
  valuesOf(affiliationStatusEnum.options),
);
export const statusInClub = pgEnum(
  'status_in_club',
  valuesOf(statusInClubEnum.options),
);
export const clubNotificationEvent = pgEnum(
  'club_notification_event',
  valuesOf(clubNotificationEventEnum.options),
);
export const userNotificationEvent = pgEnum(
  'user_notification_event',
  valuesOf(userNotificationEventEnum.options),
);
export const tournamentFormat = pgEnum(
  'tournament_format',
  valuesOf(tournamentFormatEnum.options),
);
export const tournamentType = pgEnum(
  'tournament_type',
  valuesOf(tournamentTypeEnum.options),
);
export const gameResult = pgEnum(
  'game_result',
  valuesOf(gameResultEnum.options),
);
export const roundName = pgEnum('round_name', valuesOf(roundNameEnum.options));
