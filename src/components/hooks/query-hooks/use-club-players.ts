import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useClubPlayers = (clubId: string) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.players.infiniteQueryOptions(
      { clubId, cursor: undefined },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
