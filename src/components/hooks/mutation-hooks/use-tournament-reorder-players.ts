'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import {
  applyManualPlayerOrder,
  arrayMove,
} from '@/lib/reorder-tournament-players';
import { type PlayerTournamentModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext, useRef } from 'react';

type ReorderVariables = {
  tournamentId: string;
  playerIds: string[];
};

type ReorderContext = {
  optimisticPlayers?: PlayerTournamentModel[];
  previousState?: PlayerTournamentModel[];
};

function buildOptimisticReorderContext(
  players: PlayerTournamentModel[] | undefined,
  playerIds: string[],
): ReorderContext {
  if (!players) return {};

  const playersById = new Map(players.map((player) => [player.id, player]));
  const reorderedPlayers = playerIds
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PlayerTournamentModel => !!player);

  if (reorderedPlayers.length !== players.length) {
    return { previousState: players };
  }

  return {
    previousState: players,
    optimisticPlayers: applyManualPlayerOrder(reorderedPlayers),
  };
}

export const useTournamentReorderPlayers = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<{
    variables: ReorderVariables;
    context: ReorderContext;
  } | null>(null);

  const mutation = useMutation(
    trpc.tournament.reorderPlayers.mutationOptions(),
  );

  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });

  const applyOptimisticReorder = async (
    playerIds: string[],
  ): Promise<ReorderContext> => {
    await queryClient.cancelQueries({
      queryKey: playersQueryKey,
    });

    const previousState =
      queryClient.getQueryData<Array<PlayerTournamentModel>>(playersQueryKey);
    const context = buildOptimisticReorderContext(previousState, playerIds);

    if (context.optimisticPlayers) {
      queryClient.setQueryData(playersQueryKey, context.optimisticPlayers);
    }

    return context;
  };

  const flushReorder = async (
    variables: ReorderVariables,
    context: ReorderContext,
  ): Promise<void> => {
    inFlightRef.current = true;

    try {
      await mutation.mutateAsync(variables);

      if (context.optimisticPlayers) {
        sendJsonMessage({
          event: 'reorder-players',
          body: context.optimisticPlayers,
        });
      }
    } catch {
      if (!pendingRef.current && context.previousState) {
        queryClient.setQueryData(playersQueryKey, context.previousState);
      }
    } finally {
      const pending = pendingRef.current;

      if (pending) {
        pendingRef.current = null;
        await flushReorder(pending.variables, pending.context);
        return;
      }

      inFlightRef.current = false;
      queryClient.invalidateQueries({
        queryKey: playersQueryKey,
      });
    }
  };

  const mutate = async (variables: ReorderVariables) => {
    const context = await applyOptimisticReorder(variables.playerIds);

    if (inFlightRef.current) {
      pendingRef.current = { variables, context };
      return;
    }

    void flushReorder(variables, context);
  };

  return {
    mutate,
    isPending: mutation.isPending,
  };
};

export const reorderTournamentPlayersLocally = (
  players: PlayerTournamentModel[],
  activeId: string,
  overId: string,
): PlayerTournamentModel[] => {
  const fromIndex = players.findIndex((player) => player.id === activeId);
  const toIndex = players.findIndex((player) => player.id === overId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return players;
  }

  return applyManualPlayerOrder(arrayMove(players, fromIndex, toIndex));
};
