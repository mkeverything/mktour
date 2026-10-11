import NewTournamentForm from '@/app/[locale]/(routes)/tournaments/create/new-tournament-form';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function NewTournament() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/tournaments/create');
  const userClubs = await publicCaller.user.clubs({ userId: user.id });

  return <NewTournamentForm clubs={userClubs} user={user} />;
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/tournaments/create',
    title: t('tournaments.create.title'),
    description: t('tournaments.create.description'),
    robots: { index: false, follow: true },
  });
}
