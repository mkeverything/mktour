import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useClubs = () => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.all.infiniteQueryOptions(
      {
        cursor: undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
