import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useClubLeaveMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.club.leave.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.auth.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(tErrors(getAppErrorMessage(error)));
      },
    }),
  );
};
