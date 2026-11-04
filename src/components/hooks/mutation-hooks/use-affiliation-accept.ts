import { getAppErrorMessage } from '@/lib/errors';
import { countPendingInboxMutations } from '@/components/hooks/query-hooks/use-club-inbox';
import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useAffiliationAcceptMutation({
  queryClient,
}: {
  queryClient: QueryClient;
}) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  return useMutation(
    trpc.player.affiliation.accept.mutationOptions({
      onMutate: async ({ clubId, affiliationId }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.club.inbox.all.infiniteQueryKey({ clubId }),
        });

        const prevCache = queryClient.getQueryData(
          trpc.club.inbox.all.infiniteQueryKey({ clubId }),
        );

        queryClient.setQueryData(
          trpc.club.inbox.all.infiniteQueryKey({ clubId }),
          (cache) => {
            if (!cache) return cache;

            return {
              ...cache,
              pages: cache.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.kind === 'affiliation' && item.id === affiliationId
                    ? {
                        ...item,
                        status: 'approved' as const,
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
            trpc.club.inbox.all.infiniteQueryKey({ clubId }),
            context.prevCache,
          );
        }
      },
      onSettled: (_, __, { clubId }) => {
        if (countPendingInboxMutations(queryClient, trpc) === 1) {
          queryClient.invalidateQueries({
            queryKey: trpc.club.inbox.all.infiniteQueryKey({ clubId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.club.inbox.counter.queryKey({ clubId }),
          });
        }
      },
    }),
  );
}
