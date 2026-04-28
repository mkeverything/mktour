import { PlayerTournamentModel } from '@/server/zod/players';

export type Stat =
  | keyof Pick<PlayerTournamentModel, 'wins' | 'draws' | 'losses'>
  | 'score'
  | 'tiebreak';

export const STATS_WITH_TIEBREAK: Stat[] = [
  'wins',
  'draws',
  'losses',
  'score',
  'tiebreak',
];
