'use client';

import {
  reorderTournamentPlayersLocally,
  useTournamentReorderPlayers,
} from '@/components/hooks/mutation-hooks/use-tournament-reorder-players';
import { PlayerTournamentModel } from '@/server/zod/players';
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
  const [lastOverPlayerId, setLastOverPlayerId] = useState<string | null>(null);

  const activePlayer =
    players.find((player) => player.id === activePlayerId) ?? null;

  const handleDragStart = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragStart']>
    >[0],
  ) => {
    const activeId = event.operation.source?.id;
    setActivePlayerId(typeof activeId === 'string' ? activeId : null);
    setLastOverPlayerId(null);
  };

  const handleDragOver = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragOver']>
    >[0],
  ) => {
    const activeId = event.operation.source?.id;
    const overId = event.operation.target?.id;

    if (
      typeof activeId === 'string' &&
      typeof overId === 'string' &&
      activeId !== overId
    ) {
      setLastOverPlayerId(overId);
    }
  };

  const handleDragEnd = (
    event: Parameters<
      NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
    >[0],
  ) => {
    if (!canSort) return;

    const activeId = event.operation.source?.id;
    const currentOverId = event.operation.target?.id;
    const overId =
      typeof currentOverId === 'string' && currentOverId !== activeId
        ? currentOverId
        : lastOverPlayerId;

    setActivePlayerId(null);
    setLastOverPlayerId(null);

    if (
      typeof activeId !== 'string' ||
      typeof overId !== 'string' ||
      activeId === overId
    ) {
      return;
    }

    const reorderedPlayers = reorderTournamentPlayersLocally(
      players,
      activeId,
      overId,
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
    handleDragOver,
    handleDragEnd,
  };
};
