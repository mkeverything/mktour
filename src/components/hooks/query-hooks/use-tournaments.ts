import { useTRPC } from '@/components/trpc/client';
import { TournamentsListInputModel } from '@/server/zod/discovery';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useTournaments = (
  input: Omit<TournamentsListInputModel, 'cursor'> = {},
  enabled = true,
) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.tournament.all.infiniteQueryOptions(
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
