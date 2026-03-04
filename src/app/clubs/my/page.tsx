import Dashboard from '@/app/clubs/my/dashboard';
import { clubQueryPrefetch } from '@/app/clubs/my/prefetch';
import { HydrateClient } from '@/components/trpc/server';
import { publicCaller } from '@/server/api';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';
import { redirect } from 'next/navigation';

export default async function ClubInfo() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/clubs/my');
  clubQueryPrefetch(user.selectedClub);
  const statusInClub = await publicCaller.club.authStatus({
    clubId: user.selectedClub || '',
  });

  return (
    <HydrateClient>
      <Dashboard userId={user.id} statusInClub={statusInClub} />
    </HydrateClient>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/clubs/my`;

  return {
    title: t('clubs.my.title'),
    description: t('clubs.my.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('clubs.my.title'),
      description: t('clubs.my.description'),
      url,
    },
  };
}
