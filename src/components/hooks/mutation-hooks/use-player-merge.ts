import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function usePlayerMergeMutation({
  queryClient,
  onSuccess,
}: {
  queryClient: QueryClient;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const t = useTranslations('Toasts');
  const tErrors = useTranslations('Errors');

  return useMutation(
    trpc.player.merge.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success(t('players merged'));
        onSuccess();
        queryClient.invalidateQueries({
          queryKey: trpc.club.players.infiniteQueryKey({
            clubId: variables.clubId,
          }),
        });
        queryClient.invalidateQueries({ queryKey: trpc.search.pathKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.club.stats.queryKey({ clubId: variables.clubId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.club.notifications.all.infiniteQueryKey({
            clubId: variables.clubId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.player.info.queryKey({
            playerId: variables.basePlayerId,
          }),
        });
      },
      onError: (error) => toast.error(tErrors(getAppErrorMessage(error))),
    }),
  );
}
