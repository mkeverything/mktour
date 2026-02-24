import { useTRPC } from '@/components/trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useEditPlayerMutation() {
  const t = useTranslations();
  const trpc = useTRPC();
  return useMutation(
    trpc.player.edit.mutationOptions({
      onSuccess: () => {
        toast.success(t('Toasts.player updated'));
      },
      onError: ({ message }) => {
        toast.error(
          t(
            `Errors.` +
              (JSON.parse(message).at(0)?.message ?? 'unknown server error'),
          ),
        );
      },
    }),
  );
}
