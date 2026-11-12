import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';

export const usePlayerResults = (playerId: string) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.player.results.infiniteQueryOptions(
      { playerId, cursor: undefined },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
