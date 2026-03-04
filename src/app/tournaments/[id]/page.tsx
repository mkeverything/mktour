import Dashboard from '@/app/tournaments/[id]/dashboard';
import {
  tournamentQueryClient,
  tournamentQueryPrefetch,
} from '@/app/tournaments/[id]/prefetch';
import { BASE_URL } from '@/lib/config/urls';
import { getEncryptedAuthSession } from '@/lib/get-encrypted-auth-session';
import { publicCaller } from '@/server/api';
import { ClubModel } from '@/server/zod/clubs';
import { TournamentInfoModel } from '@/server/zod/tournaments';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata, ResolvingMetadata } from 'next';
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
    tournamentQueryPrefetch(params.id);
  } catch (e) {
    console.log(e);
    notFound();
  }

  const authStatus = await publicCaller.tournament.authStatus({
    tournamentId: params.id,
  });
  const playerId = authStatus.status === 'player' ? authStatus.playerId : null;

  return (
    <HydrationBoundary state={dehydrate(tournamentQueryClient)}>
      <Dashboard
        session={session}
        id={params.id}
        status={authStatus.status}
        playerId={playerId}
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
): Promise<Metadata> {
  const params = await props.params;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const tTournaments = await getTranslations({
    locale,
    namespace: 'Seo.tournaments.format',
  });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/tournaments/${params.id}`;
  const previous = await parent;

  let tournament: TournamentInfoModel;
  let club: ClubModel | null;

  try {
    tournament = await publicCaller.tournament.info({
      tournamentId: params.id,
    });
    club = await publicCaller.club.info({
      clubId: tournament.tournament.clubId,
    });
  } catch {
    notFound();
  }

  const format = tTournaments(
    tournament.tournament.format as keyof typeof tTournaments,
  );
  const date = new Date(tournament.tournament.date).toLocaleDateString(locale);

  return {
    title: t('tournaments.tournamentPage.title', {
      name: tournament.tournament.title || `${format} ${date}`,
    }),
    description: t('tournaments.tournamentPage.description', {
      format,
      clubName: club?.name || '',
    }),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('tournaments.tournamentPage.title', {
        name: tournament.tournament.title || `${format} ${date}`,
      }),
      description: t('tournaments.tournamentPage.description', {
        format,
        clubName: club?.name || '',
      }),
      url,
    },
  };
}

export interface TournamentPageProps {
  params: Promise<{ id: string }>;
}
