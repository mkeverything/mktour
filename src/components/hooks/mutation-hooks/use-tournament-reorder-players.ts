'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTRPC } from '@/components/trpc/client';
import { buildPreStartRoundState } from '@/lib/pre-start-round';
import {
  applyManualPlayerOrder,
  arrayMove,
} from '@/lib/reorder-tournament-players';
import { type PlayerTournamentModel } from '@/server/zod/players';
import { type GameModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext, useRef } from 'react';

type ReorderVariables = {
  tournamentId: string;
  playerIds: string[];
};

type ReorderContext = {
  optimisticGames?: GameModel[];
  optimisticPlayers?: PlayerTournamentModel[];
  previousGames?: GameModel[];
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
  const saveRound = useSaveRound({ isTournamentGoing: false });
  const inFlightRef = useRef(false);
  const pendingRef = useRef<{
    variables: ReorderVariables;
    context: ReorderContext;
  } | null>(null);

  const mutation = useMutation(
    trpc.tournament.reorderPlayers.mutationOptions(),
  );

  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  const applyOptimisticReorder = async (
    playerIds: string[],
  ): Promise<ReorderContext> => {
    await queryClient.cancelQueries({
      queryKey: playersQueryKey,
    });
    await queryClient.cancelQueries({
      queryKey: roundGamesQueryKey,
    });

    const previousState =
      queryClient.getQueryData<Array<PlayerTournamentModel>>(playersQueryKey);
    const previousGames =
      queryClient.getQueryData<Array<GameModel>>(roundGamesQueryKey);
    const context = buildOptimisticReorderContext(previousState, playerIds);
    context.previousGames = previousGames;

    if (context.optimisticPlayers) {
      const preStartState = buildPreStartRoundState({
        players: context.optimisticPlayers,
        tournamentId,
      });

      context.optimisticPlayers = preStartState.players;
      context.optimisticGames = preStartState.games;

      queryClient.setQueryData(playersQueryKey, preStartState.players);
      queryClient.setQueryData(roundGamesQueryKey, preStartState.games);
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
        if (context.optimisticGames) {
          await saveRound.mutateAsync({
            tournamentId,
            roundNumber: 1,
            newGames: context.optimisticGames,
          });
        }

        sendJsonMessage({
          event: 'reorder-players',
          body: context.optimisticPlayers,
        });
      }
    } catch {
      if (!pendingRef.current && context.previousState) {
        queryClient.setQueryData(playersQueryKey, context.previousState);
      }
      if (!pendingRef.current && context.previousGames) {
        queryClient.setQueryData(roundGamesQueryKey, context.previousGames);
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
      queryClient.invalidateQueries({
        queryKey: roundGamesQueryKey,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
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
    isPending: mutation.isPending || saveRound.isPending,
  };
};

export const reorderTournamentPlayersByIndex = (
  players: PlayerTournamentModel[],
  fromIndex: number,
  toIndex: number,
): PlayerTournamentModel[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return players;
  }

  return applyManualPlayerOrder(arrayMove(players, fromIndex, toIndex));
};

export const reorderTournamentPlayersLocally = (
  players: PlayerTournamentModel[],
  activeId: string,
  overId: string,
): PlayerTournamentModel[] => {
  const fromIndex = players.findIndex((player) => player.id === activeId);
  const toIndex = players.findIndex((player) => player.id === overId);

  return reorderTournamentPlayersByIndex(players, fromIndex, toIndex);
};
