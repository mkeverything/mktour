import TournamentItemIteratee from '@/components/tournament-item';
import TournamentsAllCache from '@/components/tournament-item-cache';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { Suspense } from 'react';

export default async function Tournaments() {
  const allTournaments = await publicCaller.tournament.all();

  return (
    <main className="mk-container mk-list">
      <Suspense fallback={<TournamentsAllCache />}>
        {allTournaments.map((props) => (
          <TournamentItemIteratee key={props.tournament.id} {...props} />
        ))}
      </Suspense>
    </main>
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
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('tournaments.all.title'),
      description: t('tournaments.all.description'),
      url,
    },
  };
}
