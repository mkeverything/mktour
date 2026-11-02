import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

export const useClubNotifications = (clubId: string) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.notifications.all.infiniteQueryOptions(
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
