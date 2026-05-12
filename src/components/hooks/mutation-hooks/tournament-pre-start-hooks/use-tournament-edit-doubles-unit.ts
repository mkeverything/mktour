'use client';

import {
  findPairPlayer,
  getPairErrorTranslationKey,
  pairErrors,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/doubles-helpers';
import {
  hasDuplicateUnitNickname,
  removePlayersOutByIds,
} from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/unit-helpers';
import { useTRPC } from '@/components/trpc/client';
import { type PlayerWithUsernameModel } from '@/server/zod/players';
import { type UnitModel } from '@/server/zod/tournaments';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

const findRating = (
  playerId: string,
  playersOut: PlayerWithUsernameModel[],
  units: UnitModel[] | undefined,
) =>
  playersOut.find((player) => player.id === playerId)?.rating ??
  units
    ?.find((unit) => unit.players.some((player) => player.id === playerId))
    ?.players.find((player) => player.id === playerId)?.rating ??
  0;

export const useTournamentEditDoublesUnit = (
  tournamentId: string,
  sendJsonMessage: (_message: DashboardMessage) => void,
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Tournament.AddPlayer');
  const unitsQueryKey = trpc.tournament.units.queryKey({ tournamentId });
  const playersOutQueryKey = trpc.tournament.playersOut.queryKey({
    tournamentId,
  });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  return useMutation(
    trpc.tournament.editDoublesUnit.mutationOptions({
      async onMutate({
        currentUnitPlayerId,
        nickname,
        firstPlayerId,
        secondPlayerId,
      }) {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: unitsQueryKey }),
          queryClient.cancelQueries({ queryKey: playersOutQueryKey }),
        ]);

        const previousState =
          queryClient.getQueryData<UnitModel[]>(unitsQueryKey);
        const previousPlayersOut =
          queryClient.getQueryData<PlayerWithUsernameModel[]>(
            playersOutQueryKey,
          );
        const playersOut = previousPlayersOut ?? [];
        const currentTeam = previousState?.find(
          (unit) => unit.id === currentUnitPlayerId,
        );

        if (!currentTeam) throw new Error(pairErrors.playersNotFound);
        if (
          hasDuplicateUnitNickname(previousState, nickname, currentUnitPlayerId)
        ) {
          throw new Error(pairErrors.nicknameTaken);
        }

        const firstPair = findPairPlayer(
          firstPlayerId,
          playersOut,
          previousState,
          currentTeam.players,
        );
        const secondPair = findPairPlayer(
          secondPlayerId,
          playersOut,
          previousState,
          currentTeam.players,
        );

        if (!firstPair || !secondPair)
          throw new Error(pairErrors.playersNotFound);

        const firstRating = findRating(
          firstPlayerId,
          playersOut,
          previousState,
        );
        const secondRating = findRating(
          secondPlayerId,
          playersOut,
          previousState,
        );
        const oldMemberIds = currentTeam.players.map((player) => player.id);
        const addedIds = [firstPlayerId, secondPlayerId].filter(
          (id) => !oldMemberIds.includes(id),
        );

        const updatedTeam = {
          ...currentTeam,
          id: firstPlayerId,
          unitNickname: nickname,
          rating: Math.round((firstRating + secondRating) / 2),
          players: [firstPair, secondPair].map((player, index) => {
            const out = playersOut.find(
              (outPlayer) => outPlayer.id === player.id,
            );
            const fromUnit = currentTeam.players.find(
              (unitPlayer) => unitPlayer.id === player.id,
            );

            return {
              id: player.id,
              nickname: player.nickname,
              realname: out?.realname ?? fromUnit?.realname ?? null,
              rating: index === 0 ? firstRating : secondRating,
              userId: out?.userId ?? fromUnit?.userId ?? null,
              username: out?.username ?? fromUnit?.username ?? null,
            };
          }),
        } as UnitModel;

        queryClient.setQueryData(
          unitsQueryKey,
          (cache: UnitModel[] | undefined) => {
            const nextUnits = cache?.map((unit) =>
              unit.id === currentUnitPlayerId ? updatedTeam : unit,
            ) ?? [updatedTeam];

            return nextUnits.filter(
              (unit) => !(addedIds.includes(unit.id) && !unit.players?.length),
            );
          },
        );

        queryClient.setQueryData(playersOutQueryKey, (cache) =>
          removePlayersOutByIds(cache, addedIds),
        );

        return { previousState, previousPlayersOut };
      },
      onError: (error, _variables, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(unitsQueryKey, context.previousState);
        }
        if (context?.previousPlayersOut) {
          queryClient.setQueryData(
            playersOutQueryKey,
            context.previousPlayersOut,
          );
        }

        toast.error(t(getPairErrorTranslationKey(error)));
      },
      onSuccess: (_data, variables) => {
        const units = queryClient.getQueryData<UnitModel[]>(unitsQueryKey);
        const updatedUnit = units?.find(
          (unit) => unit.id === variables.firstPlayerId,
        );
        if (!updatedUnit) return;

        sendJsonMessage({
          event: 'edit-doubles-unit',
          body: updatedUnit,
          previousId: variables.currentUnitPlayerId,
        });
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.editDoublesUnit.mutationKey(),
          }) !== 1
        ) {
          return;
        }

        queryClient.invalidateQueries({ queryKey: unitsQueryKey });
        queryClient.invalidateQueries({ queryKey: playersOutQueryKey });
        queryClient.invalidateQueries({ queryKey: roundGamesQueryKey });
      },
    }),
  );
};
