import ClubPage from '@/app/clubs/[id]/club';
import Loading from '@/app/loading';
import { validateRequest } from '@/lib/auth/lucia';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import type { Metadata } from 'next';
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
  return (
    <Suspense fallback={<Loading />}>
      <ClubPage
        club={club}
        statusInClub={statusInClub}
        userId={user?.id || ''}
      />
    </Suspense>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/clubs/${params.id}`;

  let club;
  try {
    club = await publicCaller.club.info({ clubId: params.id });
  } catch {
    notFound();
  }

  if (!club) notFound();

  return {
    title: t('clubs.clubPage.title', { name: club.name }),
    description: t('clubs.clubPage.description', { name: club.name }),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('clubs.clubPage.title', { name: club.name }),
      description: t('clubs.clubPage.description', { name: club.name }),
      url,
    },
  };
}

export interface ClubPageProps {
  params: Promise<{ id: string }>;
}
