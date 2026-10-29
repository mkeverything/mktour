import Dashboard from '@/app/[locale]/(routes)/tournaments/[id]/dashboard';
import { formatDate } from '@/lib/local-date';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import { getQueryClient, trpc } from '@/server/api/query-client';
import { dehydrate, HydrationBoundary, noop } from '@tanstack/react-query';
import { TRPCError } from '@trpc/server';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

const notFoundOnMissing = (e: unknown): never => {
  if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
  throw e;
};

export default async function TournamentPage(props: TournamentPageProps) {
  const { id: tournamentId } = await props.params;
  const queryClient = getQueryClient();
  const [user, authStatus] = await Promise.all([
    publicCaller.auth.info(),
    publicCaller.tournament.authStatus({ tournamentId }),
    queryClient.query(trpc.tournament.info.queryOptions({ tournamentId })),
    queryClient
      .query(trpc.tournament.units.queryOptions({ tournamentId }))
      .catch(noop),
    queryClient
      .query(trpc.tournament.allGames.queryOptions({ tournamentId }))
      .catch(noop),
  ]).catch(notFoundOnMissing);
  const unitId = authStatus.status === 'player' ? authStatus.unitId : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard
        id={tournamentId}
        status={authStatus.status}
        unitId={unitId}
        userId={user?.id}
      />
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
  const tTournaments = await getTranslations({
    locale,
    namespace: 'Seo.tournaments.format',
  });

  const [tournament, units] = await Promise.all([
    publicCaller.tournament.info({ tournamentId: params.id }),
    publicCaller.tournament.units({ tournamentId: params.id }),
  ]).catch(notFoundOnMissing);

  const format = tTournaments(
    tournament.tournament.format as keyof typeof tTournaments,
  );
  const { date } = tournament.tournament;
  const title = t('tournaments.tournamentPage.title', {
    name:
      tournament.tournament.title?.trim() ||
      `${format} ${formatDate(date, locale, 'short')}`,
  });
  const description = t('tournaments.tournamentPage.description', {
    format,
    clubName: tournament.club.name.trim(),
    date: formatDate(date, locale, 'long', { withYear: true }),
    players: units.reduce((sum, unit) => sum + unit.players.length, 0),
  });

  return getPageMetadata(parent, {
    path: `/tournaments/${params.id}`,
    title,
    description,
  });
}

export interface TournamentPageProps {
  params: Promise<{ id: string }>;
}
