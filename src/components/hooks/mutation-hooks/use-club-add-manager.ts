import { getAppErrorMessage } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useClubAddManagerMutation = ({
  onSuccess,
}: {
  onSuccess: () => void;
}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.club.managers.add.mutationOptions({
      onSuccess: () => {
        toast.success('manager added');
        queryClient.invalidateQueries({
          queryKey: trpc.club.managers.all.queryKey(),
        });
        onSuccess();
      },
      onError: (error) => toast.error(tErrors(getAppErrorMessage(error))),
    }),
  );
};
