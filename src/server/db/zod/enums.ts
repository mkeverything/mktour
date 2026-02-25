import z from 'zod';

export const affiliationStatusEnum = z.enum([
  'requested_by_user',
  'requested_by_club',
  'active',
]);

export const statusInClubEnum = z.enum(['admin', 'co-owner']);

export const clubNotificationEventEnum = z.enum([
  'affiliation_request',
  'manager_left',
  'affiliation_request_approved',
  'affiliation_request_rejected',
  'affiliation_cancelled',
]);

export const userNotificationEventEnum = z.enum([
  'affiliation_approved',
  'affiliation_rejected',
  'tournament_won',
  'became_club_manager',
  'removed_from_club_managers',
]);

export const tournamentFormatEnum = z.enum([
  'swiss',
  'round robin',
  'single elimination',
  'double elimination',
]);

export const tournamentTypeEnum = z.enum(['solo', 'doubles', 'team']);

export const gameResultEnum = z.enum(['1-0', '0-1', '1/2-1/2']);

export const roundNameEnum = z.enum([
  'final',
  'match_for_third',
  'semifinal',
  'quarterfinal',
  '1/8',
  '1/16',
  '1/32',
  '1/64',
  '1/128',
]);

export type AffiliationStatus = z.infer<typeof affiliationStatusEnum>;
export type StatusInClub = z.infer<typeof statusInClubEnum>;
export type ClubNotificationEvent = z.infer<typeof clubNotificationEventEnum>;
export type UserNotificationEvent = z.infer<typeof userNotificationEventEnum>;
export type TournamentFormat = z.infer<typeof tournamentFormatEnum>;
export type TournamentType = z.infer<typeof tournamentTypeEnum>;
export type GameResult = z.infer<typeof gameResultEnum>;
export type RoundName = z.infer<typeof roundNameEnum>;
