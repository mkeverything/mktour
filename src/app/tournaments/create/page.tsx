import NewTournamentForm from '@/app/tournaments/create/new-tournament-form';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function NewTournament() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/tournaments/create');
  const userClubs = await publicCaller.user.clubs({ userId: user.id });

  return <NewTournamentForm clubs={userClubs} user={user} />;
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/tournaments/create`;
  const previous = await parent;

  return {
    title: t('tournaments.create.title'),
    description: t('tournaments.create.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('tournaments.create.title'),
      description: t('tournaments.create.description'),
      url,
    },
  };
}
