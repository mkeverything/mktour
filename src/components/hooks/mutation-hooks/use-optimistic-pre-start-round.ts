'use client';

import { useTRPC } from '@/components/trpc/client';
import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { applyManualPlayerOrder } from '@/lib/reorder-tournament-players';
import { baselinePlayerSort } from '@/lib/tournament-results';
import type { PlayerTournamentModel } from '@/server/zod/players';
import type { GameModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

export const useOptimisticPreStartRound = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });
  const preStartRoundMutationKeys = useMemo(
    () => [
      trpc.tournament.addNewPlayer.mutationKey(),
      trpc.tournament.addExistingPlayer.mutationKey(),
      trpc.tournament.addPairTeam.mutationKey(),
      trpc.tournament.removePlayer.mutationKey(),
      trpc.tournament.reorderPlayers.mutationKey(),
    ],
    [trpc],
  );

  const buildOptimisticPreStartRound = useCallback(
    (players: PlayerTournamentModel[], sortByBaseline = true) => {
      const orderedPlayers = sortByBaseline
        ? [...players].sort(baselinePlayerSort)
        : players;
      const nextPlayers = applyManualPlayerOrder(orderedPlayers);

      return {
        players: nextPlayers,
        games: generatePreStartRoundGames({
          players: nextPlayers,
          tournamentId,
        }),
      };
    },
    [tournamentId],
  );

  const applyOptimisticPreStartRound = useCallback(
    async (players: PlayerTournamentModel[], sortByBaseline = true) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: playersQueryKey }),
        queryClient.cancelQueries({ queryKey: roundGamesQueryKey }),
      ]);

      const previousPlayers =
        queryClient.getQueryData<PlayerTournamentModel[]>(playersQueryKey);
      const previousGames =
        queryClient.getQueryData<GameModel[]>(roundGamesQueryKey);
      const nextState = buildOptimisticPreStartRound(players, sortByBaseline);

      queryClient.setQueryData(playersQueryKey, nextState.players);
      queryClient.setQueryData(roundGamesQueryKey, nextState.games);

      return {
        previousPlayers,
        previousGames,
        nextPlayers: nextState.players,
        nextGames: nextState.games,
      };
    },
    [
      buildOptimisticPreStartRound,
      playersQueryKey,
      queryClient,
      roundGamesQueryKey,
    ],
  );

  const rollbackOptimisticPreStartRound = useCallback(
    (
      context?: Partial<
        Awaited<ReturnType<typeof applyOptimisticPreStartRound>>
      >,
    ) => {
      if (context?.previousPlayers) {
        queryClient.setQueryData(playersQueryKey, context.previousPlayers);
      }

      if (context?.previousGames) {
        queryClient.setQueryData(roundGamesQueryKey, context.previousGames);
      }
    },
    [playersQueryKey, queryClient, roundGamesQueryKey],
  );

  const isOnlyPendingPreStartRoundMutation = useCallback(
    () =>
      preStartRoundMutationKeys.reduce(
        (count, mutationKey) => count + queryClient.isMutating({ mutationKey }),
        0,
      ) === 1,
    [preStartRoundMutationKeys, queryClient],
  );

  return {
    applyOptimisticPreStartRound,
    buildOptimisticPreStartRound,
    isOnlyPendingPreStartRoundMutation,
    rollbackOptimisticPreStartRound,
  };
};
