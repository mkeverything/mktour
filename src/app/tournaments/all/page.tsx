import TournamentsAllList from '@/app/tournaments/all/tournaments-all-list';
import { BASE_URL } from '@/lib/config/urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import TournamentsAllCache from '@/components/tournament-item-cache';
import { Suspense } from 'react';

export default function Tournaments() {
  return (
    <main className="mk-container mk-list">
      <Suspense fallback={<TournamentsAllCache />}>
        <TournamentsAllList />
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
