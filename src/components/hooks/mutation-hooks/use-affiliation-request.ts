import { getAppErrorCode } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useAffiliationRequestMutation() {
  const t = useTranslations('Toasts');
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const client = useQueryClient();

  return useMutation(
    trpc.player.affiliation.request.mutationOptions({
      onSuccess: (_data, { clubId }) => {
        toast.success(t('affiliation requested'));
        client.invalidateQueries({
          queryKey: trpc.club.authAffiliation.queryKey({ clubId }),
        });
      },
      onError: (error) => toast.error(tErrors(getAppErrorCode(error))),
    }),
  );
}
