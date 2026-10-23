import { useTRPC } from '@/components/trpc/client';
import { ClubPlayersFilterModel } from '@/server/zod/players';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

export const useClubPlayers = (
  clubId: string,
  filter?: ClubPlayersFilterModel,
) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.club.players.infiniteQueryOptions(
      { clubId, cursor: undefined, ...filter },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        // a new sort or search keeps the current rows until the next ones arrive
        placeholderData: filter && keepPreviousData,
      },
    ),
  );
};
