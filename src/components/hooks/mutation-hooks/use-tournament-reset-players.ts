'use client';

import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export default function useTournamentResetPlayers(
  queryClient: QueryClient,
  sendJsonMessage: (_message: DashboardMessage) => void,
  setRoundInView: Dispatch<SetStateAction<number>>,
  tournamentId: string,
) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.resetPlayers.mutationOptions({
      scope: { id: `tournament-pre-start:${tournamentId}` },
      onSuccess: () => {
        sendJsonMessage({ event: 'reset-tournament-players' });
        queryClient.setQueryData(
          trpc.tournament.units.queryKey({ tournamentId }),
          [],
        );
        queryClient.setQueryData(
          trpc.tournament.allGames.queryKey({ tournamentId }),
          [],
        );
        queryClient.setQueryData(
          trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber: 1,
          }),
          [],
        );
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.pathKey(),
        });
        setRoundInView(1);
      },
      onError: (error) => {
        toast.error(tErrors(getAppErrorMessage(error)));
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.pathKey(),
        });
      },
    }),
  );
}
