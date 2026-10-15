import Dashboard from '@/app/[locale]/(routes)/tournaments/[id]/dashboard';
import {
  tournamentQueryClient,
  tournamentQueryPrefetch,
} from '@/app/[locale]/(routes)/tournaments/[id]/prefetch';
import { getEncryptedAuthSession } from '@/lib/get-encrypted-auth-session';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import { TournamentInfoModel } from '@/server/zod/tournaments';
import { formatDate } from '@/lib/local-date';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export default async function TournamentPage(props: TournamentPageProps) {
  const params = await props.params;
  const session = await getEncryptedAuthSession();
  const user = await publicCaller.auth.info();
  let tournament: TournamentInfoModel;
  try {
    tournament = await publicCaller.tournament.info({
      tournamentId: params.id,
    });
    await tournamentQueryPrefetch(params.id);
  } catch (e) {
    console.log(e);
    notFound();
  }

  const authStatus = await publicCaller.tournament.authStatus({
    tournamentId: params.id,
  });
  const unitId = authStatus.status === 'player' ? authStatus.unitId : null;

  return (
    <HydrationBoundary state={dehydrate(tournamentQueryClient)}>
      <Dashboard
        session={session}
        id={params.id}
        status={authStatus.status}
        unitId={unitId}
        userId={user?.id}
        currentRound={tournament.tournament.ongoingRound}
      />
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
  const tTournaments = await getTranslations({
    locale,
    namespace: 'Seo.tournaments.format',
  });

  let tournament: TournamentInfoModel;
  let units;

  try {
    [tournament, units] = await Promise.all([
      publicCaller.tournament.info({ tournamentId: params.id }),
      publicCaller.tournament.units({ tournamentId: params.id }),
    ]);
  } catch {
    notFound();
  }

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
