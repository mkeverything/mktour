import TournamentsAllList from '@/app/[locale]/(routes)/tournaments/all/tournaments-all-list';
import { parseDiscoveryParams, toParamsSource } from '@/lib/discovery-params';
import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getQueryClient, trpc } from '@/server/api/query-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'next/dist/server/request/search-params';
import { connection } from 'next/server';

export default async function Tournaments(props: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const t = await getTranslations('Seo');
  const { status, format, type, rated, search, radiusKm } =
    parseDiscoveryParams(toParamsSource(await props.searchParams));
  const queryClient = getQueryClient();
  const filters = { format, type, rated, search };

  // nearby results need the visitor's location, which only the browser knows
  if (!radiusKm) {
    await Promise.all([
      queryClient.prefetchInfiniteQuery(
        trpc.tournament.all.infiniteQueryOptions(
          { ...filters, status, cursor: undefined },
          { getNextPageParam: (lastPage) => lastPage.nextCursor },
        ),
      ),
      queryClient.prefetchQuery(
        trpc.tournament.statusCounts.queryOptions(filters),
      ),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mk-container md:w-full md:max-w-6xl">
        <h1 className="sr-only">{t('tournaments.all.title')}</h1>
        <TournamentsAllList />
      </main>
    </HydrationBoundary>
  );
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/tournaments/all',
    title: t('tournaments.all.title'),
    description: t('tournaments.all.description'),
  });
}
