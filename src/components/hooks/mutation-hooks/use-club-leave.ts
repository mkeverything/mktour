import { ERRORS, getAppErrorCode } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
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
        if (getAppErrorCode(error) === ERRORS.CANNOT_LEAVE_ONLY_CLUB) {
          toast.error(tErrors(ERRORS.CANNOT_LEAVE_ONLY_CLUB));
        } else if (getAppErrorCode(error) === ERRORS.NO_OTHER_CLUB_CO_OWNER) {
          toast.error(tErrors(ERRORS.NO_OTHER_CLUB_CO_OWNER));
        } else {
          toast.error(tErrors(getAppErrorCode(error)));
        }
      },
    }),
  );
};
