'use client';

import { useTRPC } from '@/components/trpc/client';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentStart(
  queryClient: QueryClient,
  tournamentId: string,
  sendJsonMessage: (_message: DashboardMessage) => void,
) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.start.mutationOptions({
      onSuccess: (games, { startedAt }) => {
        if (startedAt) {
          toast.success(t('started'));
          queryClient.setQueryData(
            trpc.tournament.roundGames.queryKey({
              tournamentId,
              roundNumber: 1,
            }),
            games,
          );
          sendJsonMessage({
            event: 'start-tournament',
            startedAt,
            games,
          });
        }
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(t('server error'));
        console.log(error);
      },
    }),
  );
}
