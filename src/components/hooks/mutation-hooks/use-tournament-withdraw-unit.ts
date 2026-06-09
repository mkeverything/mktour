'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { settlePendingGamesAsForfeit } from '@/lib/utils';
import type { GameModel } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentWithdrawUnit = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const { translateError } = useIntlError();
  const tToasts = useTranslations('Toasts');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  const { settle } = useTournamentCache(tournamentId);

  return useMutation(
    trpc.tournament.withdrawUnit.mutationOptions({
      onMutate: async ({ unitId }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.units.queryKey({ tournamentId }),
        });
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });

        const info = queryClient.getQueryData(
          trpc.tournament.info.queryKey({ tournamentId }),
        );
        const ongoingRound =
          info?.tournament.startedAt != null
            ? info.tournament.ongoingRound
            : null;

        let roundGamesRollback:
          | { roundNumber: number; data: GameModel[] }
          | undefined;
        const previousAllGames = queryClient.getQueryData(
          trpc.tournament.allGames.queryKey({ tournamentId }),
        );

        if (ongoingRound != null) {
          const roundGamesKey = trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber: ongoingRound,
          });
          await queryClient.cancelQueries({ queryKey: roundGamesKey });
          const previousRoundGames = queryClient.getQueryData(roundGamesKey);
          if (previousRoundGames) {
            roundGamesRollback = {
              roundNumber: ongoingRound,
              data: previousRoundGames,
            };
            const nextRoundGames = settlePendingGamesAsForfeit(
              previousRoundGames,
              unitId,
            );
            queryClient.setQueryData(roundGamesKey, nextRoundGames);
          }
        }

        const previousState = queryClient.getQueryData(
          trpc.tournament.units.queryKey({ tournamentId }),
        );
        if (previousAllGames !== undefined) {
          const nextAllGames = settlePendingGamesAsForfeit(
            previousAllGames,
            unitId,
          );
          queryClient.setQueryData(
            trpc.tournament.allGames.queryKey({ tournamentId }),
            nextAllGames,
          );
        }

        queryClient.setQueryData(
          trpc.tournament.units.queryKey({ tournamentId }),
          (cache) =>
            cache?.map((unit) =>
              unit.id === unitId ? { ...unit, isOut: true } : unit,
            ),
        );

        return { previousAllGames, previousState, roundGamesRollback };
      },
      onError: (_err, { unitId }, context) => {
        if (context?.previousAllGames) {
          queryClient.setQueryData(
            trpc.tournament.allGames.queryKey({ tournamentId }),
            context.previousAllGames,
          );
        }
        if (context?.roundGamesRollback) {
          queryClient.setQueryData(
            trpc.tournament.roundGames.queryKey({
              tournamentId,
              roundNumber: context.roundGamesRollback.roundNumber,
            }),
            context.roundGamesRollback.data,
          );
        }
        if (context?.previousState) {
          queryClient.setQueryData(
            trpc.tournament.units.queryKey({ tournamentId }),
            context.previousState,
          );
        }

        const unit = context?.previousState?.find(
          (previousUnit) => previousUnit.id === unitId,
        );
        toast.error(
          translateError(_err, {
            fallback: 'UNIT_NOT_WITHDRAWN',
            options: { player: unit?.unitNickname ?? '' },
          }),
          {
            id: 'withdraw-unit-error',
            duration: 3000,
          },
        );
      },
      onSettled: () => settle('withdrawUnit'),
      onSuccess: (data, { unitId }) => {
        sendJsonMessage({ event: 'withdraw-unit', id: unitId });
        if (data.roundsNumberAutoDecreased && data.roundsNumber !== null) {
          toast.info(
            tToasts('rounds number decreased automatically', {
              roundsNumber: data.roundsNumber,
            }),
          );
          sendJsonMessage({
            event: 'swiss-new-rounds-number',
            roundsNumber: data.roundsNumber,
          });
        }
      },
    }),
  );
};
