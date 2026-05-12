import {
  appendUnitIfMissing,
  createSoloUnitFromNewPlayer,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { newid } from '@/lib/utils';
import { useTRPC } from '@/components/trpc/client';
import { PlayerFormModel } from '@/server/zod/players';
import { UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useTournamentAddNewPlayer = (
  tournamentId: string,
  returnToNewPlayer: (_player: PlayerFormModel & { id?: string }) => void,
) => {
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
    trpc.tournament.addNewSoloUnit.mutationOptions({
      onMutate: async (data) => {
        data.unitId ??= newid();
        data.player.id ??= newid();
        const { unitId, player, addedAt } = data;
        const previousUnits = queryClient.getQueryData<UnitModel[]>(keys.units);
        const newUnit = createSoloUnitFromNewPlayer(
          unitId,
          player as PlayerFormModel & { id: string },
          previousUnits?.length ?? 0,
          addedAt,
        );
        return await applyOptimisticPreStartRound(
          appendUnitIfMissing(previousUnits, newUnit),
        );
      },
      onError: (_err, data, context) => {
        rollbackOptimisticPreStartRound(context);
        returnToNewPlayer(data.player);
        toast.error(t('add-player-error', { player: data.player.nickname }), {
          id: `add-player-error-${data.player.id}`,
        });
      },
      onSuccess: applyServerPreStartStateIfLatest,
      onSettled: () => invalidatePreStartState(),
    }),
  );
};
