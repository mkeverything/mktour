import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useInfiniteQuery } from '@tanstack/react-query';

export const useClubAffiliations = (clubId: string) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.affiliations.infiniteQueryOptions(
      {
        clubId,
        cursor: undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};

export const countPendingAffiliationDecisions = (
  queryClient: QueryClient,
  trpc: ReturnType<typeof useTRPC>,
) =>
  queryClient.isMutating({
    mutationKey: trpc.player.affiliation.accept.mutationKey(),
  }) +
  queryClient.isMutating({
    mutationKey: trpc.player.affiliation.reject.mutationKey(),
  });
