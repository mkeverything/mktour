import { useTRPC } from '@/components/trpc/client';
import { ClubPlayersSortModel } from '@/server/zod/players';
import { useInfiniteQuery } from '@tanstack/react-query';

export const useClubPlayers = (clubId: string, sort?: ClubPlayersSortModel) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.players.infiniteQueryOptions(
      { clubId, cursor: undefined, ...sort },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
