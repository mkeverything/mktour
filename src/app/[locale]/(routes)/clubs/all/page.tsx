import ClubsAllList from '@/app/[locale]/(routes)/clubs/all/clubs-all-list';
import { getPageUrls } from '@/lib/page-urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import Center from '@/components/center';
import { getQueryClient, trpc } from '@/components/trpc/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { connection } from 'next/server';

export default async function ClubsAllPage() {
  await connection();
  const t = await getTranslations('Seo');
  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery(
    trpc.club.all.infiniteQueryOptions(
      { cursor: undefined },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Center className="mk-list">
        <h1 className="sr-only">{t('clubs.all.title')}</h1>
        <ClubsAllList />
      </Center>
    </HydrationBoundary>
  );
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const { url, alternates } = await getPageUrls('/clubs/all');
  const previous = await parent;

  return {
    title: t('clubs.all.title'),
    description: t('clubs.all.description'),
    alternates,
    openGraph: {
      ...previous.openGraph,
      title: t('clubs.all.title'),
      description: t('clubs.all.description'),
      url,
    },
  };
}
