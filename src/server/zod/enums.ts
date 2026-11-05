import {
  affiliationStatus,
  clubNotificationEvent,
  gameResult,
  roundName,
  statusInClub,
  tournamentFormat,
  tournamentType,
  userNotificationEvent,
} from '@/server/db/schema/enums';
import { createSelectSchema } from 'drizzle-orm/zod';
import z from 'zod';

export const affiliationStatusEnum = createSelectSchema(affiliationStatus);
export const statusInClubEnum = createSelectSchema(statusInClub);
export const clubNotificationEventEnum = createSelectSchema(
  clubNotificationEvent,
);
export const userNotificationEventEnum = createSelectSchema(
  userNotificationEvent,
);
export const tournamentFormatEnum = createSelectSchema(tournamentFormat);
export const tournamentTypeEnum = createSelectSchema(tournamentType);
export const gameResultEnum = createSelectSchema(gameResult);
export const roundNameEnum = createSelectSchema(roundName);

export const openAffiliationStatusEnum = affiliationStatusEnum.extract([
  'requested',
  'approved',
]);

export const tournamentAuthStatusEnum = z.enum([
  'organizer',
  'player',
  'viewer',
]);

export type AffiliationStatus = z.infer<typeof affiliationStatusEnum>;
export type StatusInClub = z.infer<typeof statusInClubEnum>;
export type ClubNotificationEvent = z.infer<typeof clubNotificationEventEnum>;
export type UserNotificationEvent = z.infer<typeof userNotificationEventEnum>;
export type TournamentFormat = z.infer<typeof tournamentFormatEnum>;
export type TournamentAuthStatus = z.infer<typeof tournamentAuthStatusEnum>;
export type TournamentType = z.infer<typeof tournamentTypeEnum>;
export type GameResult = z.infer<typeof gameResultEnum>;
export type RoundName = z.infer<typeof roundNameEnum>;
