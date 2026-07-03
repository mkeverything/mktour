import { cn } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';

const PAIRS_THRESHOLD = 14;

export function getPlayerCount(units: UnitModel[] | undefined) {
  return units?.reduce((sum, unit) => sum + unit.players.length, 0) ?? 0;
}

export function useThreeGameColumns(units: UnitModel[] | undefined) {
  return getPlayerCount(units) > PAIRS_THRESHOLD * 2;
}

export function getGamesGridClassName(units: UnitModel[] | undefined) {
  return cn(
    'gap-mk px-mk md:px-mk-2 grid',
    useThreeGameColumns(units) ? 'grid-cols-3' : 'grid-cols-2',
  );
}
