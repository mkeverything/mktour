import { ERRORS, getAppErrorCode } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export default function useDeleteClubMutation(
  queryClient: QueryClient,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.club.delete.mutationOptions({
      onSuccess: () => {
        queryClient.removeQueries({
          queryKey: trpc.club.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.auth.pathKey(),
        });
        toast.success('club deleted');
        setOpen(false);
      },
      onError: (error) => {
        if (getAppErrorCode(error) === ERRORS.ZERO_CLUBS) {
          toast.error(tErrors(ERRORS.ZERO_CLUBS), { id: 'zeroClubsError' });
        } else {
          toast.error(tErrors(getAppErrorCode(error)), { id: 'serverError' });
        }
      },
    }),
  );
}
