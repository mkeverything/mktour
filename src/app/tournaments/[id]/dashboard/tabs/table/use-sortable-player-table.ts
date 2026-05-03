'use client';

import { useTournamentReorderPlayers } from '@/components/hooks/mutation-hooks/use-tournament-reorder-players';
import { reorderTournamentPlayersByIndex } from '@/lib/reorder-tournament-players';
import { PlayerTournamentModel } from '@/server/zod/players';
import { isSortable } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { useParams } from 'next/navigation';
import { ComponentProps, useState } from 'react';

export const useSortablePlayerTable = (
  players: PlayerTournamentModel[],
  canSort: boolean,
) => {
  const { id } = useParams<{ id: string }>();
  const reorderPlayers = useTournamentReorderPlayers(id);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  const activePlayer =
    players.find((player) => player.id === activePlayerId) ?? null;

  const handleDragStart = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragStart']>
    >[0],
  ) => {
    const activeId = event.operation.source?.id;
    setActivePlayerId(typeof activeId === 'string' ? activeId : null);
  };

  const handleDragEnd = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
    >[0],
  ) => {
    setActivePlayerId(null);

    if (!canSort || event.canceled) return;

    const source = event.operation.source;
    if (!source || !isSortable(source)) return;

    const fromIndex = source.sortable.initialIndex;
    const toIndex = source.sortable.index;

    if (fromIndex === toIndex) return;

    const reorderedPlayers = reorderTournamentPlayersByIndex(
      players,
      fromIndex,
      toIndex,
    );

    if (reorderedPlayers === players) return;

    reorderPlayers.mutate({
      tournamentId: id,
      playerIds: reorderedPlayers.map((player) => player.id),
    });
  };

  return {
    activePlayer,
    activePlayerId,
    handleDragStart,
    handleDragEnd,
  };
};
