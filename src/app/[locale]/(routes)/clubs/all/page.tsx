import ClubsAllList from '@/app/[locale]/(routes)/clubs/all/clubs-all-list';
import { parseDiscoveryParams, toParamsSource } from '@/lib/discovery-params';
import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getQueryClient, trpc } from '@/server/api/query-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SearchParams } from 'next/dist/server/request/search-params';
import { connection } from 'next/server';

export default async function ClubsAllPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const t = await getTranslations('Seo');
  const { search, radiusKm, view } = parseDiscoveryParams(
    toParamsSource(await props.searchParams),
  );
  const queryClient = getQueryClient();

  // nearby results need the visitor's location, which only the browser knows
  if (!radiusKm) {
    await Promise.all([
      queryClient.prefetchInfiniteQuery(
        trpc.club.all.infiniteQueryOptions(
          { search, cursor: undefined },
          { getNextPageParam: (lastPage) => lastPage.nextCursor },
        ),
      ),
      view === 'map' &&
        queryClient.prefetchQuery(trpc.club.locations.queryOptions({ search })),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mk-container md:w-full md:max-w-6xl">
        <h1 className="sr-only">{t('clubs.all.title')}</h1>
        <ClubsAllList />
      </main>
    </HydrationBoundary>
  );
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/clubs/all',
    title: t('clubs.all.title'),
    description: t('clubs.all.description'),
  });
}
