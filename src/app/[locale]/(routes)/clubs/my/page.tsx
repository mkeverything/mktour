import Dashboard from '@/app/[locale]/(routes)/clubs/my/dashboard';
import { clubQueryPrefetch } from '@/app/[locale]/(routes)/clubs/my/prefetch';
import { HydrateClient } from '@/components/trpc/server';
import { publicCaller } from '@/server/api';
import { getTranslations } from 'next-intl/server';
import type { ResolvingMetadata } from 'next';
import { getPageMetadata } from '@/lib/page-metadata';
import { redirect } from 'next/navigation';

export default async function ClubInfo() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/clubs/my');
  clubQueryPrefetch(user.selectedClub);
  const statusInClub = await publicCaller.club.authStatus({
    clubId: user.selectedClub || '',
  });
  if (!statusInClub) redirect(`/clubs/${user.selectedClub}`);

  return (
    <HydrateClient>
      <Dashboard userId={user.id} statusInClub={statusInClub} />
    </HydrateClient>
  );
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/clubs/my',
    title: t('clubs.my.title'),
    description: t('clubs.my.description'),
    robots: { index: false, follow: false },
  });
}
