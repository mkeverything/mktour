import { getAppErrorMessage } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useEditUserMutation(queryClient: QueryClient) {
  const t = useTranslations('Toasts');
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.auth.edit.mutationOptions({
      onSuccess: () => {
        toast.success(t('profile updated'));
        queryClient.invalidateQueries({
          queryKey: trpc.auth.info.queryKey(),
        });
      },
      onError: (error) => toast.error(tErrors(getAppErrorMessage(error))),
    }),
  );
}
