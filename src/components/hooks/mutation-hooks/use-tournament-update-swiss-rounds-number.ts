'use client';

import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useSaveRoundsNumberMutation(
  tournamentId: string,
  queryClient: QueryClient,
  sendJsonMessage: (_message: DashboardMessage) => void,
) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.updateSwissRoundsNumber.mutationOptions({
      scope: { id: `tournament-pre-start:${tournamentId}` },
      onMutate: async ({ roundsNumber }) => {
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
        toast.error(tErrors(getAppErrorMessage(error)));
        if (context?.previousData) {
          queryClient.setQueryData(
            trpc.tournament.info.queryKey({ tournamentId }),
            context.previousData,
          );
        }
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            predicate: (mutation) =>
              mutation.options.scope?.id ===
              `tournament-pre-start:${tournamentId}`,
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.info.pathKey(),
          });
        }
      },
    }),
  );
}
