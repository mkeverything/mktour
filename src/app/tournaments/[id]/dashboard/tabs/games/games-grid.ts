import { cn } from '@/lib/utils';
import { UnitModel } from '@/server/zod/tournaments';

const PAIRS_THRESHOLD = 14;
const FULL_WIDTH_PAIRS_THRESHOLD = 7;

export function getPlayerCount(units: UnitModel[] | undefined) {
  return units?.reduce((sum, unit) => sum + unit.players.length, 0) ?? 0;
}

export function getPairCount(units: UnitModel[] | undefined) {
  return Math.floor((units?.length ?? 0) / 2);
}

export function shouldUseThreeGameColumns(units: UnitModel[] | undefined) {
  return getPlayerCount(units) > PAIRS_THRESHOLD * 2;
}

export function shouldUseFullWidthGameItems(units: UnitModel[] | undefined) {
  return getPairCount(units) < FULL_WIDTH_PAIRS_THRESHOLD;
}

export function getGamesGridClassName(units: UnitModel[] | undefined) {
  return cn(
    'gap-mk px-mk md:px-mk-2 grid grid-cols-2',
    shouldUseFullWidthGameItems(units) && 'max-lg:@max-3xl:grid-cols-1',
    shouldUseThreeGameColumns(units) && 'lg:grid-cols-3',
  );
}
