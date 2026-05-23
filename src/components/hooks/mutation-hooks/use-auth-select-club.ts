import { useTRPC } from '@/components/trpc/client';
import { getAppErrorCode } from '@/lib/errors';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useAuthSelectClub = (queryClient: QueryClient) => {
  const trpc = useTRPC();
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.auth.selectClub.mutationOptions({
      onMutate: ({ clubId }) => {
        queryClient.cancelQueries({ queryKey: trpc.auth.pathKey() });

        const previousState = queryClient.getQueryData(
          trpc.auth.info.queryKey(),
        );

        queryClient.setQueryData(
          trpc.auth.info.queryKey(),
          (cache) =>
            cache && {
              ...cache,
              selectedClub: clubId,
            },
        );
        return { previousState };
      },

      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.auth.selectClub.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.auth.pathKey(),
          });
        }
      },
      onError: (error, _variables, context) => {
        toast.error(tErrors(getAppErrorCode(error)), {
          id: 'error',
          duration: 3000,
        });
        console.log(context);
        queryClient.setQueryData(
          trpc.auth.info.queryKey(),
          context?.previousState,
        );
      },
    }),
  );
};
