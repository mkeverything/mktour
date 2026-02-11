import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useEditClubMutation(queryClient: QueryClient) {
  const trpc = useTRPC();
  const t = useTranslations('Toasts');
  return useMutation(
    trpc.club.edit.mutationOptions({
      onSuccess: () => {
        toast.success(t('club updated'));
        queryClient.invalidateQueries({ queryKey: trpc.club.info.queryKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.auth.clubs.queryKey(),
        });
      },
      onError: () => toast.error(t('server error')),
    }),
  );
}
