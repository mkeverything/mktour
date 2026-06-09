'use client';

import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { applyManualUnitOrder } from '@/lib/reorder-tournament-units';
import { baselineUnitSort } from '@/lib/tournament-results';
import type { GameModel, UnitModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export const useOptimisticPreStartRound = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { pendingWriters } = useTournamentCache(tournamentId);
  const unitsQueryKey = trpc.tournament.units.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  const buildOptimisticPreStartRound = useCallback(
    (units: UnitModel[], sortByBaseline = true) => {
      const orderedUnits = sortByBaseline
        ? units.toSorted(baselineUnitSort)
        : units;
      const nextUnits = applyManualUnitOrder(orderedUnits);

      return {
        units: nextUnits,
        games: generatePreStartRoundGames({
          units: nextUnits,
          tournamentId,
        }),
      };
    },
    [tournamentId],
  );

  const applyOptimisticPreStartRound = useCallback(
    async (units: UnitModel[], sortByBaseline = true) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: unitsQueryKey }),
        queryClient.cancelQueries({ queryKey: roundGamesQueryKey }),
      ]);

      const previousUnits =
        queryClient.getQueryData<UnitModel[]>(unitsQueryKey);
      const previousGames =
        queryClient.getQueryData<GameModel[]>(roundGamesQueryKey);
      const nextState = buildOptimisticPreStartRound(units, sortByBaseline);

      queryClient.setQueryData(unitsQueryKey, nextState.units);
      queryClient.setQueryData(roundGamesQueryKey, nextState.games);

      return {
        previousUnits,
        previousGames,
        nextUnits: nextState.units,
        nextGames: nextState.games,
      };
    },
    [
      buildOptimisticPreStartRound,
      unitsQueryKey,
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
      if (context?.previousUnits) {
        queryClient.setQueryData(unitsQueryKey, context.previousUnits);
      }

      if (context?.previousGames) {
        queryClient.setQueryData(roundGamesQueryKey, context.previousGames);
      }
    },
    [unitsQueryKey, queryClient, roundGamesQueryKey],
  );

  const isOnlyPendingPreStartRoundMutation = useCallback(
    () => pendingWriters('units') === 1,
    [pendingWriters],
  );

  return {
    applyOptimisticPreStartRound,
    buildOptimisticPreStartRound,
    isOnlyPendingPreStartRoundMutation,
    rollbackOptimisticPreStartRound,
  };
};
