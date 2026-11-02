import { getAppErrorMessage } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useAffiliationRejectMutation({
  queryClient,
}: {
  queryClient: QueryClient;
}) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.player.affiliation.reject.mutationOptions({
      onMutate: async ({ clubId, affiliationId }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.club.affiliations.infiniteQueryKey({ clubId }),
        });

        const prevCache = queryClient.getQueryData(
          trpc.club.affiliations.infiniteQueryKey({ clubId }),
        );

        queryClient.setQueryData(
          trpc.club.affiliations.infiniteQueryKey({ clubId }),
          (cache) => {
            if (!cache) return cache;

            return {
              ...cache,
              pages: cache.pages.map((page) => ({
                ...page,
                affiliations: page.affiliations.map((item) =>
                  item.id === affiliationId
                    ? {
                        ...item,
                        status: 'rejected' as const,
                        updatedAt: new Date(),
                      }
                    : item,
                ),
              })),
            };
          },
        );

        return { prevCache };
      },
      onError: (_err, { clubId }, context) => {
        toast.error(tErrors(getAppErrorMessage(_err)));
        if (context?.prevCache) {
          queryClient.setQueryData(
            trpc.club.affiliations.infiniteQueryKey({ clubId }),
            context.prevCache,
          );
        }
      },
      onSettled: (_, __, { clubId }) => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.player.affiliation.reject.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.club.affiliations.infiniteQueryKey({ clubId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.club.notifications.counter.queryKey({ clubId }),
          });
        }
      },
    }),
  );
}
