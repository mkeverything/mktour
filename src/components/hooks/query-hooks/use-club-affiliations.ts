import { useTRPC } from '@/components/trpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';

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
