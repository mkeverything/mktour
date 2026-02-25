import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function useAffiliationCancelByClubMutation() {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.player.affiliation.cancelByClub.mutationOptions({
      onSuccess: (_data, { playerId, clubId }) => {
        queryClient.invalidateQueries({
          queryKey: trpc.player.info.queryKey({ playerId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.club.notifications.all.queryKey({ clubId }),
        });
      },
      onError: () => toast.error(t('server error')),
    }),
  );
}

export const useAffiliationCancelByUserMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.player.affiliation.cancelByUser.mutationOptions({
      onSuccess: (_, { playerId }) => {
        queryClient.invalidateQueries({
          queryKey: trpc.player.info.queryKey({ playerId }),
        });
      },
    }),
  );
};
