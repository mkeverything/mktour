import { removeUnitById } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { ERRORS } from '@/lib/errors';
import type { UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useTournamentRemoveUnit = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const { translateError } = useIntlError();
  const trpc = useTRPC();
  const {
    applyOptimisticPreStartRound,
    applyServerPreStartUnitsIfLatest,
    invalidatePreStartState,
    keys,
    rollbackOptimisticPreStartRound,
  } = useSharedPreStart(tournamentId);

  return useMutation(
    trpc.tournament.removeUnit.mutationOptions({
      onMutate: async ({ unitId }) => {
        await queryClient.cancelQueries({ queryKey: keys.playersOut });
        const previousUnits = queryClient.getQueryData<UnitModel[]>(keys.units);
        return await applyOptimisticPreStartRound(
          removeUnitById(previousUnits, unitId),
        );
      },
      onError: (err, { unitId }, context) => {
        rollbackOptimisticPreStartRound(context);
        const unit = context?.previousUnits?.find((u) => u.id === unitId);
        toast.error(
          translateError(err, {
            fallback: ERRORS.UNIT_NOT_REMOVED,
            options: { player: unit?.unitNickname ?? '' },
          }),
        );
      },
      onSuccess: applyServerPreStartUnitsIfLatest,
      onSettled: () => invalidatePreStartState({ playersOut: true }),
    }),
  );
};
