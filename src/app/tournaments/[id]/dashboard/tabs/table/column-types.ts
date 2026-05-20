import { UnitModel } from '@/server/zod/tournaments';

export type Stat =
  | keyof Pick<UnitModel, 'wins' | 'draws' | 'losses'>
  | 'score'
  | 'tiebreak';

export const STATS_WITH_TIEBREAK: Stat[] = [
  'wins',
  'draws',
  'losses',
  'score',
  'tiebreak',
];
