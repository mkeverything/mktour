'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useOptimisticPreStartRound } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-optimistic-pre-start-round';
import { useTRPC } from '@/components/trpc/client';
import type { UnitModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';

export const useSharedPreStart = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const optimisticPreStartRound = useOptimisticPreStartRound(tournamentId);

  const keys = {
    units: trpc.tournament.units.queryKey({ tournamentId }),
    playersOut: trpc.tournament.playersOut.queryKey({ tournamentId }),
    roundGames: trpc.tournament.roundGames.queryKey({
      tournamentId,
      roundNumber: 1,
    }),
    allGames: trpc.tournament.allGames.queryKey({ tournamentId }),
    info: trpc.tournament.info.queryKey({ tournamentId }),
  };

  const applyServerPreStartUnits = (units: UnitModel[]) => {
    const nextState = optimisticPreStartRound.buildOptimisticPreStartRound(
      units,
      false,
    );
    queryClient.setQueryData(keys.units, nextState.units);
    queryClient.setQueryData(keys.roundGames, nextState.games);
    sendJsonMessage({
      event: 'prestart-units-updated',
      units: nextState.units,
    });
  };

  const applyServerPreStartUnitsIfLatest = (units: UnitModel[]) => {
    if (!optimisticPreStartRound.isOnlyPendingPreStartRoundMutation()) return;
    applyServerPreStartUnits(units);
  };

  const invalidatePreStartState = (
    options: { playersOut?: boolean; info?: boolean; allGames?: boolean } = {},
  ) => {
    if (
      queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.scope?.id === `tournament-pre-start:${tournamentId}`,
      }) !== 1
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: keys.roundGames });
    if (options.playersOut) {
      queryClient.invalidateQueries({ queryKey: keys.playersOut });
    }
    if (options.allGames ?? true) {
      queryClient.invalidateQueries({ queryKey: keys.allGames });
    }
    if (options.info ?? true) {
      queryClient.invalidateQueries({ queryKey: keys.info });
    }
  };

  return {
    keys,
    ...optimisticPreStartRound,
    applyServerPreStartUnits,
    applyServerPreStartUnitsIfLatest,
    invalidatePreStartState,
  };
};
