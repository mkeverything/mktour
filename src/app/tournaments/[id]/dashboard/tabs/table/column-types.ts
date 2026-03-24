import { PlayerTournamentModel } from '@/server/zod/players';

export type STAT =
  | keyof Pick<PlayerTournamentModel, 'wins' | 'draws' | 'losses'>
  | 'score'
  | 'tiebreak';

export const STATS_WITH_TIEBREAK: STAT[] = [
  'wins',
  'draws',
  'losses',
  'score',
  'tiebreak',
];
