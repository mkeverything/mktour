'use client';

import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentFinish({
  tournamentId,
  sendJsonMessage,
}: SetStatusProps) {
  const t = useTranslations('Toasts');
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const { settle } = useTournamentCache(tournamentId);
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
      },
      onSettled: () => settle('finish'),
      onError: (error) => {
        toast.error(tErrors(getAppErrorMessage(error)));
        console.log(error);
      },
    }),
  );
}

type SetStatusProps = {
  tournamentId: string;
  sendJsonMessage: (_message: DashboardMessage) => void;
};
