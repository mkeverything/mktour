import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { useIntlError } from '@/components/hooks/use-intl-error';

export default function useDeleteClubMutation(
  queryClient: QueryClient,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const { translateError } = useIntlError();
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
        toast.error(translateError(error, { fallback: 'CLUB_NOT_DELETED' }), {
          id: 'serverError',
        });
      },
    }),
  );
}
