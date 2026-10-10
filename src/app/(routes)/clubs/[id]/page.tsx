import ClubPage from '@/app/(routes)/clubs/[id]/club';
import Loading from '@/app/loading';
import { getQueryClient, trpc } from '@/components/trpc/server';
import { validateRequest } from '@/lib/auth/lucia';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

export default async function Page(props: ClubPageProps) {
  const params = await props.params;
  const club = await publicCaller.club.info({ clubId: params.id });
  const { user } = await validateRequest();
  const statusInClub = await publicCaller.club.authStatus({
    clubId: params.id,
  });

  if (!club) notFound();

  const queryClient = getQueryClient();
  const getNextPageParam = (lastPage: { nextCursor: number | null }) =>
    lastPage.nextCursor;
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.club.stats.queryOptions({ clubId: club.id }),
    ),
    queryClient.prefetchQuery(
      trpc.club.managers.all.queryOptions({ clubId: club.id }),
    ),
    queryClient.prefetchInfiniteQuery(
      trpc.club.tournaments.infiniteQueryOptions(
        { clubId: club.id, cursor: undefined },
        { getNextPageParam },
      ),
    ),
    queryClient.prefetchInfiniteQuery(
      trpc.club.players.infiniteQueryOptions(
        { clubId: club.id, cursor: undefined },
        { getNextPageParam },
      ),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<Loading />}>
        <ClubPage
          club={club}
          statusInClub={statusInClub}
          userId={user?.id || ''}
        />
      </Suspense>
    </HydrationBoundary>
  );
}

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const params = await props.params;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/clubs/${params.id}`;
  const previous = await parent;

  let club;
  try {
    club = await publicCaller.club.info({ clubId: params.id });
  } catch {
    notFound();
  }

  if (!club) notFound();

  const [stats, latest] = await Promise.all([
    publicCaller.club.stats({ clubId: club.id }),
    publicCaller.club.tournaments({ clubId: club.id, limit: 1 }),
  ]);
  const latestTournament = latest.tournaments[0];
  const description = latestTournament
    ? t('clubs.clubPage.description', {
        name: club.name,
        players: stats.playersCount,
        tournaments: stats.tournamentsCount,
        date: new Date(latestTournament.date).toLocaleDateString(locale),
      })
    : t('clubs.clubPage.descriptionEmpty', { name: club.name });

  return {
    title: t('clubs.clubPage.title', { name: club.name }),
    description,
    alternates: { canonical: url },
    // clubs without tournaments are thin until they have content
    ...(latestTournament ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      ...previous.openGraph,
      title: t('clubs.clubPage.title', { name: club.name }),
      description,
      url,
    },
  };
}

export interface ClubPageProps {
  params: Promise<{ id: string }>;
}
