'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentWithdrawPlayer = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Errors');
  const tToasts = useTranslations('Toasts');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);

  return useMutation(
    trpc.tournament.withdrawPlayer.mutationOptions({
      onMutate: async ({ playerId }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
        });

        const previousState = queryClient.getQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
        );

        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache) =>
            cache?.map((player) =>
              player.id === playerId ? { ...player, isOut: true } : player,
            ),
        );

        return { previousState };
      },
      onError: (_err, { playerId }, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(
            trpc.tournament.playersIn.queryKey({ tournamentId }),
            context.previousState,
          );
        }

        if (_err.message === 'WITHDRAWAL_REDUCES_ROUNDS_BELOW_CURRENT') {
          toast.error(t('withdraw-player-rounds-error'), {
            id: 'withdraw-player-rounds-error',
            duration: 3000,
          });
          return;
        }

        const player = context?.previousState?.find(
          (previousPlayer) => previousPlayer.id === playerId,
        );
        if (!player) {
          toast.error(
            t('internal-error', {
              error: 'player not found in context.previousState',
            }),
            {
              id: 'internal-error',
              duration: 3000,
            },
          );
          return;
        }

        toast.error(
          t('withdraw-player-error', {
            player: player.nickname,
          }),
          {
            id: 'withdraw-player-error',
            duration: 3000,
          },
        );
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.withdrawPlayer.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.info.queryKey({ tournamentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.pathKey(),
          });
        }
      },
      onSuccess: (data, { playerId }) => {
        sendJsonMessage({ event: 'withdraw-player', id: playerId });
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
