'use client';

import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export default function useTournamentDelete(
  queryClient: QueryClient,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.delete.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        router.push('/tournaments/my');
        router.refresh();
        queryClient.cancelQueries({
          queryKey: trpc.tournament.pathKey(),
        });
      },
      onError: (error) => {
        if (error.message !== 'NEXT_REDIRECT') {
          console.error('SERVER_ERROR', error);
          toast.error(tErrors(getAppErrorMessage(error)));
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.pathKey(),
          });
        } else {
          console.log('NEXT_REDIRECT going oon');
          router.push('/tournaments/my');
          router.refresh();
        }
      },
    }),
  );
}
