import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useClubTournaments = (clubId: string) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.tournaments.infiniteQueryOptions(
      { clubId, cursor: undefined },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
