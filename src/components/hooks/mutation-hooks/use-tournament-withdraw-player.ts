'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import type { GameModel } from '@/server/zod/tournaments';
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
            queryClient.setQueryData(
              roundGamesKey,
              (cache: GameModel[] | undefined) =>
                filterPendingGamesByPlayer(cache, playerId),
            );
          }
        }

        const previousState = queryClient.getQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
        );
        queryClient.setQueryData(
          trpc.tournament.allGames.queryKey({ tournamentId }),
          (cache: GameModel[] | undefined) =>
            filterPendingGamesByPlayer(cache, playerId),
        );

        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache) =>
            cache?.map((player) =>
              player.id === playerId ? { ...player, isOut: true } : player,
            ),
        );

        return { previousAllGames, previousState, roundGamesRollback };
      },
      onError: (_err, { playerId }, context) => {
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

function filterPendingGamesByPlayer(
  games: GameModel[] | undefined,
  playerId: string,
) {
  return games?.filter(
    (game) =>
      game.result != null ||
      (game.whiteId !== playerId && game.blackId !== playerId),
  );
}
