import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentRemovePlayer = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Errors');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  const mutationKey = trpc.tournament.removePlayer.mutationKey();
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
        await queryClient.cancelQueries({ queryKey: playersQueryKey });
        const previousState = queryClient.getQueryData(playersQueryKey);

        queryClient.setQueryData(
          playersQueryKey,
          (cache) => cache && cache.filter((player) => player.id !== playerId),
        );

        return { previousState };
      },
      onError: (err, { playerId }, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(playersQueryKey, context.previousState);
        }
        const player = context?.previousState?.find(
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
        if (queryClient.isMutating({ mutationKey }) !== 1) return;
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
        if (queryClient.isMutating({ mutationKey }) !== 1) return;
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
