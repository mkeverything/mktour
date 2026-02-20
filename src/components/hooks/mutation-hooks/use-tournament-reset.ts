'use client';

import { useTRPC } from '@/components/trpc/client';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export default function useTournamentReset(
  _tournamentId: string,
  queryClient: QueryClient,
  sendJsonMessage: (_message: DashboardMessage) => void,
  setRoundInView: Dispatch<SetStateAction<number>>,
) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.reset.mutationOptions({
      onSuccess: () => {
        sendJsonMessage({ event: 'reset-tournament' });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.pathKey(),
        });
        setRoundInView(1);
      },
      onError: () => {
        toast.error(t('server error'));
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.pathKey(),
        });
      },
    }),
  );
}
