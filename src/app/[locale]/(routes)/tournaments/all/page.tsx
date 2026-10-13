import TournamentsAllList from '@/app/[locale]/(routes)/tournaments/all/tournaments-all-list';
import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getQueryClient, trpc } from '@/components/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

export default async function Tournaments() {
  await connection();
  const t = await getTranslations('Seo');
  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery(
    trpc.tournament.all.infiniteQueryOptions(
      { cursor: undefined },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mk-container mk-list">
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
