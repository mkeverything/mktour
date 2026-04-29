'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { applyManualPlayerOrder } from '@/lib/reorder-tournament-players';
import { type PlayerTournamentModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';

type ReorderContext = {
  newPlayers?: PlayerTournamentModel[];
  previousState?: PlayerTournamentModel[];
};

function buildReorderContext(
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
    newPlayers: applyManualPlayerOrder(reorderedPlayers),
  };
}

export const useTournamentReorderPlayers = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);

  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });
  const reorderMutationKey = trpc.tournament.reorderPlayers.mutationKey();

  return useMutation(
    trpc.tournament.reorderPlayers.mutationOptions({
      onMutate: async ({ playerIds }): Promise<ReorderContext> => {
        await queryClient.cancelQueries({
          queryKey: playersQueryKey,
        });
        await queryClient.cancelQueries({
          queryKey: roundGamesQueryKey,
        });

        const previousState =
          queryClient.getQueryData<Array<PlayerTournamentModel>>(
            playersQueryKey,
          );
        const context = buildReorderContext(previousState, playerIds);

        if (context.newPlayers) {
          queryClient.setQueryData(playersQueryKey, context.newPlayers);
        }

        return context;
      },
      onError: (_error, _variables, context) => {
        if (
          queryClient.isMutating({
            mutationKey: reorderMutationKey,
          }) !== 1
        ) {
          return;
        }

        if (context?.previousState) {
          queryClient.setQueryData(playersQueryKey, context.previousState);
        }
      },
      onSuccess: (data) => {
        if (
          queryClient.isMutating({
            mutationKey: reorderMutationKey,
          }) !== 1
        ) {
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
        if (
          queryClient.isMutating({
            mutationKey: reorderMutationKey,
          }) !== 1
        ) {
          return;
        }

        queryClient.invalidateQueries({
          queryKey: playersQueryKey,
        });
        queryClient.invalidateQueries({
          queryKey: roundGamesQueryKey,
        });
        return queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });
      },
    }),
  );
};
