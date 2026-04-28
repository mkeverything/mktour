'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTRPC } from '@/components/trpc/client';
import { buildPreStartRoundPairings } from '@/lib/pre-start-round';
import { applyManualPlayerOrder } from '@/lib/reorder-tournament-players';
import { type PlayerTournamentModel } from '@/server/zod/players';
import { type GameModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';

type ReorderContext = {
  newGames?: GameModel[];
  newPlayers?: PlayerTournamentModel[];
  previousGames?: GameModel[];
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
  const saveRound = useSaveRound({
    isTournamentGoing: false,
  });

  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });
  const reorderMutationKey = trpc.tournament.reorderPlayers.mutationKey();

  const applyNewOrder = async (
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
    const context = buildReorderContext(previousState, playerIds);
    context.previousGames = previousGames;

    if (context.newPlayers) {
      const preStartPairings = buildPreStartRoundPairings({
        players: context.newPlayers,
        tournamentId,
      });

      context.newPlayers = preStartPairings.players;
      context.newGames = preStartPairings.games;

      queryClient.setQueryData(playersQueryKey, preStartPairings.players);
      queryClient.setQueryData(roundGamesQueryKey, preStartPairings.games);
    }

    return context;
  };

  return useMutation(
    trpc.tournament.reorderPlayers.mutationOptions({
      onMutate: ({ playerIds }) => applyNewOrder(playerIds),
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
        if (context?.previousGames) {
          queryClient.setQueryData(roundGamesQueryKey, context.previousGames);
        }
      },
      onSuccess: (_data, variables, context) => {
        if (
          !context?.newPlayers ||
          !context.newGames ||
          queryClient.isMutating({
            mutationKey: reorderMutationKey,
          }) !== 1
        ) {
          return;
        }

        sendJsonMessage({
          event: 'reorder-players',
          body: context.newPlayers,
        });
        saveRound.mutate({
          tournamentId: variables.tournamentId,
          roundNumber: 1,
          newGames: context.newGames,
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

        return queryClient.invalidateQueries({
          queryKey: playersQueryKey,
        });
      },
    }),
  );
};
