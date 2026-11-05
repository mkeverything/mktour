import { countPendingInboxMutations } from '@/components/hooks/query-hooks/use-club-inbox';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import type { AffiliationModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type DecisionProcedure = ReturnType<
  typeof useTRPC
>['player']['affiliation']['accept'];

export function useAffiliationAcceptMutation() {
  const trpc = useTRPC();
  return useAffiliationDecisionMutation({
    procedure: trpc.player.affiliation.accept,
    status: 'approved',
  });
}

export function useAffiliationRejectMutation() {
  const trpc = useTRPC();
  return useAffiliationDecisionMutation({
    procedure: trpc.player.affiliation.reject,
    status: 'rejected',
  });
}

function useAffiliationDecisionMutation({
  procedure,
  status,
}: {
  procedure: DecisionProcedure;
  status: AffiliationModel['status'];
}) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    procedure.mutationOptions({
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
                    ? { ...item, status, updatedAt: new Date() }
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
