import ClubsAllList from '@/app/clubs/all/clubs-all-list';
import { BASE_URL } from '@/lib/config/urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import ClubsIteratee from '@/app/clubs/all/clubs-list';
import Center from '@/components/center';
import { publicCaller } from '@/server/api';
import { Suspense } from 'react';

export default async function ClubSettings() {
  const { clubs } = await publicCaller.club.all({});

  return (
    <Center className="mk-list">
      <Suspense fallback={<ClubsIteratee clubs={clubs.slice(0, 5)} />}>
        <ClubsAllList />
      </Suspense>
    </Center>
  );
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/clubs/all`;
  const previous = await parent;

  return {
    title: t('clubs.all.title'),
    description: t('clubs.all.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('clubs.all.title'),
      description: t('clubs.all.description'),
      url,
    },
  };
}
