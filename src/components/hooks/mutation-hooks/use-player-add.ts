import { useTRPC } from '@/components/trpc/client';
import { getAppErrorCode } from '@/lib/errors';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const usePlayerAddMutation = (queryClient: QueryClient) => {
  const trpc = useTRPC();
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.player.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.club.players.infiniteQueryKey({
            clubId: variables.clubId,
          }),
        });
      },
      onError: (error) => toast.error(tErrors(getAppErrorCode(error))),
    }),
  );
};
