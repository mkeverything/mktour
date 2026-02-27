import TournamentItemIteratee from '@/components/tournament-item';
import TournamentsAllCache from '@/components/tournament-item-cache';
import { publicCaller } from '@/server/api';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';

import { Suspense } from 'react';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/tournaments/all`;

  return {
    title: t('tournaments.title'),
    description: t('tournaments.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('tournaments.title'),
      description: t('tournaments.description'),
      url,
    },
  };
}

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
