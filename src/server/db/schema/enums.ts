import { pgEnum } from 'drizzle-orm/pg-core';

export const affiliationStatus = pgEnum('affiliation_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
]);
export const statusInClub = pgEnum('status_in_club', ['admin', 'co-owner']);
export const clubNotificationEvent = pgEnum('club_notification_event', [
  'manager_left',
  'affiliation_cancelled',
  'player_merged',
]);
export const userNotificationEvent = pgEnum('user_notification_event', [
  'affiliation_approved',
  'affiliation_rejected',
  'affiliation_cancelled',
  'tournament_won',
  'became_club_manager',
  'removed_from_club_managers',
]);
export const tournamentFormat = pgEnum('tournament_format', [
  'swiss',
  'round robin',
  // 'single elimination',
  // 'double elimination',
]);
export const tournamentType = pgEnum('tournament_type', ['solo', 'doubles']); //team removed until implementatin
export const gameResult = pgEnum('game_result', ['1-0', '0-1', '1/2-1/2']);
export const roundName = pgEnum('round_name', [
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
