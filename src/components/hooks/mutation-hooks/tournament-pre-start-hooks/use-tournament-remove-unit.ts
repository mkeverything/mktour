import { removeUnitById } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useTRPC } from '@/components/trpc/client';
import type { UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useTournamentRemoveUnit = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Errors');
  const trpc = useTRPC();
  const {
    applyOptimisticPreStartRound,
    applyServerPreStartStateIfLatest,
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
      onError: (_err, { unitId }, context) => {
        rollbackOptimisticPreStartRound(context);
        const unit = context?.previousUnits?.find((u) => u.id === unitId);
        if (!unit) {
          toast.error(
            t('internal-error', {
              error: 'unit not found in context.previousUnits',
            }),
            { id: 'internal-error', duration: 3000 },
          );
          return;
        }
        toast.error(t('remove-player-error', { player: unit.unitNickname }), {
          id: 'remove-player-error',
          duration: 3000,
        });
      },
      onSuccess: applyServerPreStartStateIfLatest,
      onSettled: () => invalidatePreStartState({ playersOut: true }),
    }),
  );
};
