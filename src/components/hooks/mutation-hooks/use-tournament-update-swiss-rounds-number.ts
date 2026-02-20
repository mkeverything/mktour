'use client';

import { useTRPC } from '@/components/trpc/client';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentSaveRoundsNumber(
  queryClient: QueryClient,
  sendJsonMessage: (_message: DashboardMessage) => void,
) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.updateSwissRoundsNumber.mutationOptions({
      onMutate: async ({ tournamentId, roundsNumber }) => {
        queryClient.cancelQueries({
          queryKey: trpc.tournament.info.queryKey({ tournamentId }),
        });
        const previousData = queryClient.getQueryData(
          trpc.tournament.info.queryKey({ tournamentId }),
        );
        queryClient.setQueryData(
          trpc.tournament.info.queryKey({ tournamentId }),
          (cache) => {
            if (!cache) return cache;
            return {
              ...cache,
              tournament: { ...cache.tournament, roundsNumber },
            };
          },
        );
        return { previousData };
      },
      onSuccess: (_, { roundsNumber }) => {
        sendJsonMessage({ event: 'swiss-new-rounds-number', roundsNumber });
      },
      onError: (error, { tournamentId }, context) => {
        toast.error(t('server error') + `: ` + error.message);
        if (context?.previousData) {
          queryClient.setQueryData(
            trpc.tournament.info.queryKey({ tournamentId }),
            context.previousData,
          );
        }
      },
      onSettled: () => {
        if (queryClient.isMutating() === 1) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.info.pathKey(),
          });
        }
      },
    }),
  );
}
