import {
  TOURNAMENT_QUERIES,
  useTournamentCache,
} from '@/components/hooks/mutation-hooks/tournament-cache';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { handleTournamentEvent } from '@/lib/handle-tournament-event';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscription } from '@trpc/tanstack-react-query';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export const useTournamentEvents = (
  tournamentId: string,
  setRoundInView: Dispatch<SetStateAction<number>>,
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { translateMessage } = useIntlError();
  const { pendingWriters, refresh } = useTournamentCache(tournamentId);

  useSubscription(
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
          }),
        onError: () =>
          toast.error(translateMessage('REALTIME_FAILED'), {
            id: 'realtimeError',
          }),
      },
    ),
  );
};
