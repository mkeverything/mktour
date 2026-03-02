'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export default function useTournamentEditTitle() {
  const { sendJsonMessage } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.editTournamentTitle.mutationOptions({
      onMutate: async ({ tournamentId, title }) => {
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
              tournament: { ...cache.tournament, title },
            };
          },
        );
        return { previousData };
      },
      onSuccess: (_, { title }) => {
        sendJsonMessage({ event: 'tournament-title-changed', title });
        toast.success(t('tournament renamed'));
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
