import { useTRPC } from '@/components/trpc/client';
import { ClubsListInputModel } from '@/server/zod/discovery';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useClubs = (
  input: Omit<ClubsListInputModel, 'cursor'> = {},
  enabled = true,
) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.all.infiniteQueryOptions(
      {
        ...input,
        cursor: undefined,
      },
      {
        enabled,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
