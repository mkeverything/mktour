import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { ERRORS } from '@/lib/errors';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useEditPlayerMutation() {
  const t = useTranslations();
  const { translateError } = useIntlError();
  const trpc = useTRPC();
  return useMutation(
    trpc.player.edit.mutationOptions({
      onSuccess: () => {
        toast.success(t('Toasts.player updated'));
      },
      onError: (error) => {
        toast.error(
          translateError(error, { fallback: ERRORS.PLAYER_NOT_EDITED }),
        );
      },
    }),
  );
}
