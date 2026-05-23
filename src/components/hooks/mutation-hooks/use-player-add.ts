import { useTRPC } from '@/components/trpc/client';
import { useIntlError } from '@/components/hooks/use-intl-error';
import { ERRORS } from '@/lib/errors';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export const usePlayerAddMutation = (queryClient: QueryClient) => {
  const trpc = useTRPC();
  const { translateError } = useIntlError();
  return useMutation(
    trpc.player.create.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.club.players.infiniteQueryKey({
            clubId: variables.clubId,
          }),
        });
      },
      onError: (error) => {
        toast.error(
          translateError(error, { fallback: ERRORS.PLAYER_NOT_CREATED }),
        );
      },
    }),
  );
};
