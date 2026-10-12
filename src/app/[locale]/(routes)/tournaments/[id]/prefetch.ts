import { getQueryClient, trpc } from '@/components/trpc/server';

const tournamentQueryClient = getQueryClient();

const tournamentQueryPrefetch = async (tournamentId: string) => {
  await Promise.all([
    tournamentQueryClient.prefetchQuery(
      trpc.tournament.units.queryOptions({ tournamentId }),
    ),

    tournamentQueryClient.prefetchQuery(
      trpc.tournament.info.queryOptions({ tournamentId }),
    ),
    tournamentQueryClient.prefetchQuery(
      trpc.tournament.allGames.queryOptions({ tournamentId }),
    ),
  ]);
};

export { tournamentQueryClient, tournamentQueryPrefetch };
