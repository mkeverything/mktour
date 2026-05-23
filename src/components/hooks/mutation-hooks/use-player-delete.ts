import { ERRORS, getAppErrorCode } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

// FIXME
export default function useDeletePlayerMutation(
  queryClient: QueryClient,
  clubId: string,
) {
  const trpc = useTRPC();
  const t = useTranslations('Toasts');
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.player.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t('player deleted'));
        queryClient.invalidateQueries({
          queryKey: trpc.club.players.infiniteQueryKey({ clubId }),
        });
      },
      onError: (error) =>
        getAppErrorCode(error) === ERRORS.PLAYER_HAS_TOURNAMENTS
          ? toast.error(tErrors(ERRORS.PLAYER_HAS_TOURNAMENTS))
          : toast.error(tErrors(getAppErrorCode(error))),
    }),
  );
}
