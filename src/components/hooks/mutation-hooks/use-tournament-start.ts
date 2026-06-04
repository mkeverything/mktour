'use client';

import { getAppErrorMessage } from '@/lib/errors';
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
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.start.mutationOptions({
      scope: { id: `tournament-pre-start:${tournamentId}` },
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
          queryClient.setQueryData(
            trpc.tournament.allGames.queryKey({ tournamentId }),
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
        toast.error(tErrors(getAppErrorMessage(error)));
        console.log(error);
      },
    }),
  );
}
