import { applyManualUnitOrder } from '@/lib/reorder-tournament-units';
import type { UnitModel } from '@/server/zod/tournaments';

export const buildReorderContext = (
  units: UnitModel[] | undefined,
  unitIds: string[],
) => {
  if (!units) return {};

  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const reorderedUnits = unitIds
    .map((unitId) => unitsById.get(unitId))
    .filter((unit): unit is UnitModel => !!unit);

  if (reorderedUnits.length !== units.length) {
    return { previousState: units };
  }

  return {
    previousState: units,
    newUnits: applyManualUnitOrder(reorderedUnits),
  };
};
