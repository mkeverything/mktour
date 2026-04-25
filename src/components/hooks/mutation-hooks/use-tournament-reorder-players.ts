'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { buildPreStartRoundState } from '@/lib/pre-start-round';
import { applyManualPlayerOrder } from '@/lib/reorder-tournament-players';
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
  const persistChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });
  const reorderMutationKey = trpc.tournament.reorderPlayers.mutationKey();
  const reorderMutationOptions =
    trpc.tournament.reorderPlayers.mutationOptions();
  const saveRoundMutationOptions = trpc.tournament.saveRound.mutationOptions();

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

  return useMutation({
    ...reorderMutationOptions,
    mutationKey: reorderMutationKey,
    mutationFn: (variables: ReorderVariables, mutationContext) => {
      const persist = async () => {
        if (
          !reorderMutationOptions.mutationFn ||
          !saveRoundMutationOptions.mutationFn
        ) {
          throw new Error('missing tournament reorder mutation function');
        }

        await reorderMutationOptions.mutationFn(variables, mutationContext);

        const context = buildOptimisticReorderContext(
          queryClient.getQueryData<Array<PlayerTournamentModel>>(
            playersQueryKey,
          ),
          variables.playerIds,
        );

        if (context.optimisticPlayers) {
          const preStartState = buildPreStartRoundState({
            players: context.optimisticPlayers,
            tournamentId,
          });

          await saveRoundMutationOptions.mutationFn(
            {
              tournamentId: variables.tournamentId,
              roundNumber: 1,
              newGames: preStartState.games,
            },
            mutationContext,
          );
        }
      };

      const nextPersist = persistChainRef.current
        .catch(() => undefined)
        .then(persist);

      persistChainRef.current = nextPersist.catch(() => undefined);

      return nextPersist;
    },
    onMutate: ({ playerIds }) => applyOptimisticReorder(playerIds),
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
    onSuccess: (_data, _variables, context) => {
      if (
        !context?.optimisticPlayers ||
        queryClient.isMutating({
          mutationKey: reorderMutationKey,
        }) !== 1
      ) {
        return;
      }

      sendJsonMessage({
        event: 'reorder-players',
        body: context.optimisticPlayers,
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

      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: playersQueryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: roundGamesQueryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        }),
      ]);
    },
  });
};
