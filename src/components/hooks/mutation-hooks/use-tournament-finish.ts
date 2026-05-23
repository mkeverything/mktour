'use client';

import { ERRORS, getAppErrorCode } from '@/lib/errors';
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
  const tErrors = useTranslations('Errors');
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
        if (getAppErrorCode(error) === ERRORS.INCOMPLETE_GAMES) {
          toast.error(tErrors(ERRORS.INCOMPLETE_GAMES));
          return;
        }
        toast.error(tErrors(getAppErrorCode(error)));
        console.log(error);
      },
    }),
  );
}

type SetStatusProps = {
  tournamentId: string | undefined;
  sendJsonMessage: (_message: DashboardMessage) => void;
};
