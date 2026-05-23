import { doublesErrors } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/doubles-helpers';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { AppError, ERRORS } from '@/lib/errors';
import {
  appendUnitIfMissing,
  createDoublesUnit,
  hasDuplicateUnitNickname,
  removePlayersOutByIds,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useTRPC } from '@/components/trpc/client';
import { newid } from '@/lib/utils';
import { type PlayerWithUsernameModel } from '@/server/zod/players';
import { UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useTournamentAddDoublesUnit = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { translateError } = useIntlError();
  const {
    applyOptimisticPreStartRound,
    applyServerPreStartUnitsIfLatest,
    invalidatePreStartState,
    keys,
    rollbackOptimisticPreStartRound,
  } = useSharedPreStart(tournamentId);

  return useMutation(
    trpc.tournament.addDoublesUnit.mutationOptions({
      async onMutate(data) {
        data.unitId ??= newid();
        const { unitId, nickname, firstPlayerId, secondPlayerId, addedAt } =
          data;
        await queryClient.cancelQueries({ queryKey: keys.playersOut });

        const previousUnits = queryClient.getQueryData<UnitModel[]>(keys.units);
        const previousPlayersOut = queryClient.getQueryData<
          PlayerWithUsernameModel[]
        >(keys.playersOut);

        if (hasDuplicateUnitNickname(previousUnits, nickname)) {
          throw new AppError(doublesErrors.nicknameTaken);
        }

        const playersOut = previousPlayersOut ?? [];
        const firstPlayer = playersOut.find(
          (player) => player.id === firstPlayerId,
        );
        const secondPlayer = playersOut.find(
          (player) => player.id === secondPlayerId,
        );

        if (!firstPlayer || !secondPlayer) {
          throw new AppError(doublesErrors.playersNotFound);
        }

        const newUnit = createDoublesUnit({
          id: unitId,
          nickname,
          firstPlayer,
          secondPlayer,
          number: previousUnits?.length ?? 0,
          addedAt,
        });
        const context = await applyOptimisticPreStartRound(
          appendUnitIfMissing(previousUnits, newUnit),
        );

        queryClient.setQueryData(keys.playersOut, (cache) =>
          removePlayersOutByIds(cache, [firstPlayerId, secondPlayerId]),
        );

        return { ...context, previousPlayersOut };
      },
      onError: (error, _data, context) => {
        rollbackOptimisticPreStartRound(context);

        if (context?.previousPlayersOut) {
          queryClient.setQueryData(keys.playersOut, context.previousPlayersOut);
        }

        toast.error(translateError(error, { fallback: ERRORS.UNIT_NOT_ADDED }));
      },
      onSuccess: applyServerPreStartUnitsIfLatest,
      onSettled: () => invalidatePreStartState({ playersOut: true }),
    }),
  );
};
