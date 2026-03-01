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
      onError: (error) => {
        if (isLinkTeamError(error)) return;
        toast.error(t('server error'));
      },
    }),
  );
}

function isLinkTeamError(error: unknown): boolean {
  if (typeof error === 'string') return error.includes('LINK_TEAM_ERROR');
  if (!error || typeof error !== 'object') return false;

  const message = (error as { message?: string }).message;
  if (typeof message === 'string' && message.includes('LINK_TEAM_ERROR')) {
    return true;
  }

  return JSON.stringify(error).includes('LINK_TEAM_ERROR');
}
