'use client';

import { useTournamentReorderUnits } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-reorder-units';
import { reorderTournamentUnitsByIndex } from '@/lib/reorder-tournament-units';
import { UnitModel } from '@/server/zod/tournaments';
import { isSortable } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { useParams } from 'next/navigation';
import { ComponentProps, useState } from 'react';

export const useSortableUnitTable = (units: UnitModel[], canSort: boolean) => {
  const { id } = useParams<{ id: string }>();
  const reorderUnits = useTournamentReorderUnits(id);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

  const activeUnit = units.find((unit) => unit.id === activeUnitId) ?? null;

  const handleDragStart = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragStart']>
    >[0],
  ) => {
    const activeId = event.operation.source?.id;
    setActiveUnitId(typeof activeId === 'string' ? activeId : null);
  };

  const handleDragEnd = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
    >[0],
  ) => {
    setActiveUnitId(null);

    if (!canSort || event.canceled) return;

    const source = event.operation.source;
    if (!source || !isSortable(source)) return;

    const fromIndex = source.sortable.initialIndex;
    const toIndex = source.sortable.index;

    if (fromIndex === toIndex) return;

    const reorderedUnits = reorderTournamentUnitsByIndex(
      units,
      fromIndex,
      toIndex,
    );

    if (reorderedUnits === units) return;

    reorderUnits.mutate({
      tournamentId: id,
      unitIds: reorderedUnits.map((unit) => unit.id),
    });
  };

  return {
    activeUnit,
    activeUnitId,
    handleDragStart,
    handleDragEnd,
  };
};
