'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useOptimisticPreStartRound } from '@/components/hooks/mutation-hooks/use-optimistic-pre-start-round';
import { useTRPC } from '@/components/trpc/client';
import { applyManualPlayerOrder } from '@/lib/reorder-tournament-players';
import { type PlayerTournamentModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

function buildReorderContext(
  players: PlayerTournamentModel[] | undefined,
  playerIds: string[],
) {
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
    newPlayers: applyManualPlayerOrder(reorderedPlayers),
  };
}

export const useTournamentReorderPlayers = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const {
    applyOptimisticPreStartRound,
    isOnlyPendingPreStartRoundMutation,
    rollbackOptimisticPreStartRound,
  } = useOptimisticPreStartRound(tournamentId);

  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  const applyReorderOptimistically = useCallback(
    async (playerIds: string[]) => {
      const previousState =
        queryClient.getQueryData<Array<PlayerTournamentModel>>(playersQueryKey);
      const context = buildReorderContext(previousState, playerIds);

      if (!context.newPlayers) {
        return {
          previousPlayers: context.previousState,
        };
      }

      const nextContext = await applyOptimisticPreStartRound(
        context.newPlayers,
        false,
      );

      return {
        ...nextContext,
        newPlayers: context.newPlayers,
      };
    },
    [applyOptimisticPreStartRound, playersQueryKey, queryClient],
  );

  const mutationOptions = trpc.tournament.reorderPlayers.mutationOptions();
  return useMutation({
    ...mutationOptions,
    onMutate: async ({ playerIds }) => {
      return applyReorderOptimistically(playerIds);
    },
    onError: (_error, _variables, context) => {
      if (!isOnlyPendingPreStartRoundMutation()) {
        return;
      }

      rollbackOptimisticPreStartRound(context);
    },
    onSuccess: (data) => {
      if (!isOnlyPendingPreStartRoundMutation()) {
        return;
      }

      queryClient.setQueryData(playersQueryKey, data.players);
      queryClient.setQueryData(roundGamesQueryKey, data.games);
      sendJsonMessage({
        event: 'prestart-round-updated',
        players: data.players,
        games: data.games,
        roundNumber: 1,
      });
    },
    onSettled: () => {
      if (!isOnlyPendingPreStartRoundMutation()) {
        return;
      }

      return queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
      });
    },
  });
};
