import { prefetch, trpc } from '@/server/api/query-client';

const clubQueryPrefetch = (clubId: string) => {
  prefetch(trpc.auth.info.queryOptions());
  prefetch(trpc.auth.clubs.queryOptions());
  prefetch(trpc.club.info.queryOptions({ clubId }));
  prefetch(
    trpc.club.players.infiniteQueryOptions(
      {
        clubId,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
  prefetch(
    trpc.club.tournaments.infiniteQueryOptions(
      {
        clubId,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
};

export { clubQueryPrefetch };
