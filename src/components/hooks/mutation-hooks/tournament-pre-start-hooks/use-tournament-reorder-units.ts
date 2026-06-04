'use client';

import { buildReorderContext } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/reorder-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useTRPC } from '@/components/trpc/client';
import { type UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export const useTournamentReorderUnits = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    applyOptimisticPreStartRound,
    applyServerPreStartUnitsIfLatest,
    invalidatePreStartState,
    keys,
    rollbackOptimisticPreStartRound,
  } = useSharedPreStart(tournamentId);

  const applyReorderOptimistically = useCallback(
    async (unitIds: string[]) => {
      const previousState = queryClient.getQueryData<UnitModel[]>(keys.units);
      const context = buildReorderContext(previousState, unitIds);

      if (!context.newUnits) {
        return { previousUnits: context.previousState };
      }

      const nextContext = await applyOptimisticPreStartRound(
        context.newUnits,
        false,
      );

      return { ...nextContext, newUnits: context.newUnits };
    },
    [applyOptimisticPreStartRound, keys.units, queryClient],
  );

  const mutationOptions = trpc.tournament.reorderUnits.mutationOptions();
  return useMutation({
    ...mutationOptions,
    scope: { id: `tournament-pre-start:${tournamentId}` },
    onMutate: ({ unitIds }) => applyReorderOptimistically(unitIds),
    onError: (_error, _variables, context) => {
      rollbackOptimisticPreStartRound(context);
    },
    onSuccess: applyServerPreStartUnitsIfLatest,
    onSettled: () => invalidatePreStartState({ info: false }),
  });
};
