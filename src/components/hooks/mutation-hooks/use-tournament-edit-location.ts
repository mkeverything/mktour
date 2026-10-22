import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentEditLocation(tournamentId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const t = useTranslations('Discovery.Location');
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.tournament.editLocation.mutationOptions({
      onSuccess: () => {
        toast.success(t('updated'));
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.info.queryKey({ tournamentId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.all.pathKey(),
        });
      },
      onError: (error) => toast.error(tErrors(getAppErrorMessage(error))),
    }),
  );
}
