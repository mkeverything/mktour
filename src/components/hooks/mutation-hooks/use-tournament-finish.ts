'use client';

import { useTRPC } from '@/components/trpc/client';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentFinish(
  queryClient: QueryClient,
  { tournamentId, sendJsonMessage }: SetStatusProps,
) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.finish.mutationOptions({
      onSuccess: (_error, { closedAt }) => {
        if (closedAt) {
          toast.success(t('finished'));
          sendJsonMessage({
            event: 'finish-tournament',
            closedAt,
          });
        }
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.info.queryKey({ tournamentId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.units.queryKey({ tournamentId }),
        });
      },
      onError: (error) => {
        if (error.message === 'INCOMPLETE_GAMES') {
          toast.error(t('incomplete games'));
          return;
        }
        toast.error(t('server error'));
        console.log(error);
      },
    }),
  );
}

type SetStatusProps = {
  tournamentId: string | undefined;
  sendJsonMessage: (_message: DashboardMessage) => void;
};
