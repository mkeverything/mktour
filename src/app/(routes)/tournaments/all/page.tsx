import TournamentsAllList from '@/app/(routes)/tournaments/all/tournaments-all-list';
import { BASE_URL } from '@/lib/config/urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { getQueryClient, trpc } from '@/components/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

export default async function Tournaments() {
  await connection();
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
        <TournamentsAllList />
      </main>
    </HydrationBoundary>
  );
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/tournaments/all`;
  const previous = await parent;

  return {
    title: t('tournaments.all.title'),
    description: t('tournaments.all.description'),
    alternates: { canonical: url },
    openGraph: {
      ...previous.openGraph,
      title: t('tournaments.all.title'),
      description: t('tournaments.all.description'),
      url,
    },
  };
}
