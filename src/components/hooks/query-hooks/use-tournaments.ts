import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useTournaments = () => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.tournament.all.infiniteQueryOptions(
      {
        cursor: undefined,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
