import {
  appendUnitIfMissing,
  createSoloUnitFromNewPlayer,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { newid } from '@/lib/utils';
import { PlayerFormModel } from '@/server/zod/players';
import { UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useTournamentAddNewPlayer = (
  tournamentId: string,
  returnToNewPlayer: (_player: PlayerFormModel & { id?: string }) => void,
) => {
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
        toast.error(
          translateError(_err, {
            fallback: 'UNIT_NOT_ADDED',
            options: { player: data.player.nickname },
          }),
          { id: `add-player-error-${data.player.id}` },
        );
      },
      onSuccess: applyServerPreStartUnitsIfLatest,
      onSettled: () => invalidatePreStartState(),
    }),
  );
};
