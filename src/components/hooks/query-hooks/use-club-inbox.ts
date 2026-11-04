import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';

export const useClubInbox = (clubId: string) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.inbox.infiniteQueryOptions(
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

export const useClubInboxCounter = (clubId: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.club.notifications.counter.queryOptions({ clubId }));
};

export const countPendingInboxMutations = (
  queryClient: QueryClient,
  trpc: ReturnType<typeof useTRPC>,
) =>
  [
    trpc.player.affiliation.accept.mutationKey(),
    trpc.player.affiliation.reject.mutationKey(),
    trpc.club.notifications.toggleSeen.mutationKey(),
  ].reduce(
    (count, mutationKey) => count + queryClient.isMutating({ mutationKey }),
    0,
  );
