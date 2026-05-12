import { UnitModel } from '@/server/zod/tournaments';

export const arrayMove = <T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] => {
  const next = [...items];
  const [movedItem] = next.splice(fromIndex, 1);

  if (!movedItem) return items;

  next.splice(toIndex, 0, movedItem);
  return next;
};

export const applyManualUnitOrder = (units: UnitModel[]): UnitModel[] => {
  return units.map((unit, index) => ({
    ...unit,
    number: index,
  }));
};

export const reorderTournamentUnitsByIndex = (
  units: UnitModel[],
  fromIndex: number,
  toIndex: number,
): UnitModel[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return units;
  }

  return applyManualUnitOrder(arrayMove(units, fromIndex, toIndex));
};
