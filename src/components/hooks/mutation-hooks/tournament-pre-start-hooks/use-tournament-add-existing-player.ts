import {
  appendUnitIfMissing,
  createSoloUnitFromExistingPlayer,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { newid } from '@/lib/utils';
import { type PlayerWithUsernameModel } from '@/server/zod/players';
import { UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useTournamentAddExistingPlayer = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const { translateError } = useIntlError();
  const trpc = useTRPC();
  const {
    applyOptimisticPreStartRound,
    applyServerPreStartUnitsIfLatest,
    settle,
    keys,
    rollbackOptimisticPreStartRound,
  } = useSharedPreStart(tournamentId);

  return useMutation(
    trpc.tournament.addSoloUnit.mutationOptions({
      scope: { id: `tournament-pre-start:${tournamentId}` },
      onMutate: async (data) => {
        data.unitId ??= newid();
        const { unitId, player, addedAt } = data;
        await queryClient.cancelQueries({ queryKey: keys.playersOut });
        const previousPlayersOut = queryClient.getQueryData<
          PlayerWithUsernameModel[]
        >(keys.playersOut);
        const previousUnits = queryClient.getQueryData<UnitModel[]>(keys.units);
        const newUnit = createSoloUnitFromExistingPlayer(
          unitId,
          player,
          previousUnits?.length ?? 0,
          addedAt,
        );
        const context = await applyOptimisticPreStartRound(
          appendUnitIfMissing(previousUnits, newUnit),
        );

        queryClient.setQueryData(keys.playersOut, (cache) =>
          cache?.filter((pl) => pl.id !== player.id),
        );

        return { ...context, previousPlayersOut };
      },
      onError: (_err, data, context) => {
        rollbackOptimisticPreStartRound(context);
        if (context?.previousPlayersOut) {
          queryClient.setQueryData(keys.playersOut, context.previousPlayersOut);
        }
        toast.error(
          translateError(_err, {
            fallback: 'UNIT_NOT_ADDED',
            options: { player: data.player.nickname },
          }),
          { id: `add-player-error-${data.player.id}` },
        );
      },
      onSuccess: applyServerPreStartUnitsIfLatest,
      onSettled: () => settle('addSoloUnit'),
    }),
  );
};
