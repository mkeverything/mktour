'use client';

import {
  doublesErrors,
  findDoublesUnitPlayer,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/doubles-helpers';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { AppError, ERRORS } from '@/lib/errors';
import {
  hasDuplicateUnitNickname,
  removePlayersOutByIds,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useSharedPreStart } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-shared-pre-start';
import { useTRPC } from '@/components/trpc/client';
import { type UnitModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useTournamentEditDoublesUnit = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { translateError } = useIntlError();
  const {
    applyOptimisticPreStartRound,
    applyServerPreStartUnitsIfLatest,
    invalidatePreStartState,
    keys,
    rollbackOptimisticPreStartRound,
  } = useSharedPreStart(tournamentId);

  return useMutation(
    trpc.tournament.editDoublesUnit.mutationOptions({
      async onMutate({ unitId, nickname, firstPlayerId, secondPlayerId }) {
        await queryClient.cancelQueries({ queryKey: keys.playersOut });

        const previousUnits = queryClient.getQueryData<UnitModel[]>(keys.units);
        const previousPlayersOut = queryClient.getQueryData(keys.playersOut);
        const currentUnit = previousUnits?.find((unit) => unit.id === unitId);

        if (firstPlayerId === secondPlayerId) {
          throw new AppError(doublesErrors.invalidDoublesPair);
        }
        if (!currentUnit) throw new AppError(doublesErrors.playersNotFound);
        if (hasDuplicateUnitNickname(previousUnits, nickname, unitId)) {
          throw new AppError(doublesErrors.nicknameTaken);
        }

        const playersOut = previousPlayersOut ?? [];
        const firstPlayer = findDoublesUnitPlayer(
          firstPlayerId,
          playersOut,
          currentUnit,
        );
        const secondPlayer = findDoublesUnitPlayer(
          secondPlayerId,
          playersOut,
          currentUnit,
        );

        if (!firstPlayer || !secondPlayer) {
          throw new AppError(doublesErrors.playersNotFound);
        }

        const nextUnit: UnitModel = {
          ...currentUnit,
          unitNickname: nickname,
          players: [firstPlayer, secondPlayer],
        };
        const nextUnits =
          previousUnits?.map((unit) =>
            unit.id === unitId ? nextUnit : unit,
          ) ?? [];
        const context = await applyOptimisticPreStartRound(nextUnits, false);
        const currentMemberIds = currentUnit.players.map((player) => player.id);
        const addedIds = [firstPlayerId, secondPlayerId].filter(
          (id) => !currentMemberIds.includes(id),
        );

        queryClient.setQueryData(keys.playersOut, (cache) =>
          removePlayersOutByIds(cache, addedIds),
        );

        return { ...context, previousPlayersOut };
      },
      onError: (error, _variables, context) => {
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
