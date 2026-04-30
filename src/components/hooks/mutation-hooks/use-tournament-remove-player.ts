import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useOptimisticPreStartRound } from '@/components/hooks/mutation-hooks/use-optimistic-pre-start-round';
import { useTRPC } from '@/components/trpc/client';
import type { PlayerTournamentModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentRemovePlayer = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Errors');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  const {
    applyOptimisticPreStartRound,
    isOnlyPendingPreStartRoundMutation,
    rollbackOptimisticPreStartRound,
  } = useOptimisticPreStartRound(tournamentId);
  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const playersOutQueryKey = trpc.tournament.playersOut.queryKey({
    tournamentId,
  });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  return useMutation(
    trpc.tournament.removePlayer.mutationOptions({
      onMutate: async ({ playerId }) => {
        await queryClient.cancelQueries({ queryKey: playersOutQueryKey });
        const previousState =
          queryClient.getQueryData<PlayerTournamentModel[]>(playersQueryKey);
        const nextPlayers =
          previousState?.filter((player) => player.id !== playerId) ?? [];

        const context = await applyOptimisticPreStartRound(nextPlayers);

        return { ...context };
      },
      onError: (err, { playerId }, context) => {
        rollbackOptimisticPreStartRound(context);
        const player = context?.previousPlayers?.find(
          (player) => player.id === playerId,
        );
        if (!player) {
          toast.error(
            t('internal-error', {
              error: 'player not found in context.previousState',
            }),
            { id: 'internal-error', duration: 3000 },
          );
          return;
        }
        console.log({ err });
        toast.error(t('remove-player-error', { player: player.nickname }), {
          id: 'remove-player-error',
          duration: 3000,
        });
      },
      onSuccess: (data) => {
        if (!isOnlyPendingPreStartRoundMutation()) return;
        queryClient.setQueryData(playersQueryKey, data.players);
        queryClient.setQueryData(roundGamesQueryKey, data.games);
        sendJsonMessage({
          event: 'prestart-round-updated',
          players: data.players,
          games: data.games,
          roundNumber: 1,
        });
      },
      onSettled: () => {
        if (!isOnlyPendingPreStartRoundMutation()) return;
        queryClient.invalidateQueries({ queryKey: playersQueryKey });
        queryClient.invalidateQueries({ queryKey: playersOutQueryKey });
        queryClient.invalidateQueries({ queryKey: roundGamesQueryKey });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.info.queryKey({ tournamentId }),
        });
      },
    }),
  );
};
