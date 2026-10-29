'use client';

import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentEditTitle(tournamentId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('Toasts');
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const { settle } = useTournamentCache(tournamentId);
  return useMutation(
    trpc.tournament.editTitle.mutationOptions({
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
      onSuccess: () => {
        toast.success(t('tournament renamed'));
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
      onSettled: () => settle('editTitle'),
    }),
  );
}
