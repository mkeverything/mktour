import {
  TOURNAMENT_QUERIES,
  useTournamentCache,
} from '@/components/hooks/mutation-hooks/tournament-cache';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { handleTournamentEvent } from '@/lib/handle-tournament-event';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscription } from '@trpc/tanstack-react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Dispatch, SetStateAction, useEffect } from 'react';
import { toast } from 'sonner';

const RECONNECTING_TOAST_DELAY_MS = 5_000;

export const useTournamentEvents = (
  tournamentId: string,
  setRoundInView: Dispatch<SetStateAction<number>>,
  setSelectedGameId: Dispatch<SetStateAction<string | null>>,
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { translateMessage } = useIntlError();
  const t = useTranslations('Toasts');
  const router = useRouter();
  const { pendingWriters, refresh } = useTournamentCache(tournamentId);

  const { status, reset } = useSubscription(
    trpc.tournament.events.subscriptionOptions(
      { tournamentId },
      {
        // also catches up on whatever changed while the stream was down
        onStarted: () => {
          toast.dismiss('realtimeError');
          refresh(TOURNAMENT_QUERIES);
        },
        onData: (event) =>
          handleTournamentEvent(event, {
            queryClient,
            trpc,
            tournamentId,
            pendingWriters,
            refresh,
            setRoundInView,
            setSelectedGameId,
            onDeleted: () => {
              toast.info(t('tournament deleted'));
              router.push('/tournaments/all');
            },
          }),
        onError: () =>
          toast.error(translateMessage('REALTIME_FAILED'), {
            id: 'realtimeError',
          }),
      },
    ),
  );

  const reconnecting = status === 'connecting';
  useEffect(() => {
    if (!reconnecting) return;
    const timeout = setTimeout(() => {
      toast.loading(t('reconnecting'), { id: 'realtimeReconnecting' });
      posthog.capture('realtime_stream_down', { tournament_id: tournamentId });
    }, RECONNECTING_TOAST_DELAY_MS);
    return () => {
      clearTimeout(timeout);
      toast.dismiss('realtimeReconnecting');
    };
  }, [reconnecting, t, tournamentId]);

  // ios safari drops the stream of a hidden page; reconnect at once when it is back
  useEffect(() => {
    if (status === 'pending') return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reset();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [status, reset]);
};
