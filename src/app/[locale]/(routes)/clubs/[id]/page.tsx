import ClubPage from '@/app/[locale]/(routes)/clubs/[id]/club';
import { getQueryClient, trpc } from '@/server/api/query-client';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import { formatDate } from '@/lib/local-date';
import { CLUB_PLAYERS_DEFAULT_SORT } from '@/server/zod/players';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export default async function Page(props: ClubPageProps) {
  const params = await props.params;
  const [club, user, statusInClub] = await Promise.all([
    publicCaller.club.info({ clubId: params.id }),
    publicCaller.auth.info(),
    publicCaller.club.authStatus({ clubId: params.id }),
  ]);

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
        { clubId: club.id, cursor: undefined, ...CLUB_PLAYERS_DEFAULT_SORT },
        { getNextPageParam },
      ),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClubPage club={club} statusInClub={statusInClub} userId={user?.id} />
    </HydrationBoundary>
  );
}

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  },
  parent: ResolvingMetadata,
) {
  const params = await props.params;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });

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
  const name = club.name.trim();
  const description = latestTournament
    ? t('clubs.clubPage.description', {
        name,
        players: stats.playersCount,
        tournaments: stats.tournamentsCount,
        date: formatDate(latestTournament.date, locale, 'long', {
          withYear: true,
        }),
      })
    : t('clubs.clubPage.descriptionEmpty', { name });

  return getPageMetadata(parent, {
    path: `/clubs/${params.id}`,
    title: t('clubs.clubPage.title', { name }),
    description,
    // clubs without tournaments are thin until they have content
    ...(latestTournament ? {} : { robots: { index: false, follow: true } }),
  });
}

export interface ClubPageProps {
  params: Promise<{ id: string }>;
}
