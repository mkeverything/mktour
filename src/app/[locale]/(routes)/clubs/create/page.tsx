import ForwardToEmptyClub from '@/app/[locale]/(routes)/clubs/create/forward-to-empty-club';
import NewClubForm from '@/app/[locale]/(routes)/clubs/create/new-club-form';
import { getUserLichessTeams } from '@/lib/api/lichess';
import { publicCaller } from '@/server/api';
import { getTranslations } from 'next-intl/server';
import type { ResolvingMetadata } from 'next';
import { getPageMetadata } from '@/lib/page-metadata';
import { redirect } from 'next/navigation';

export default async function CreateClubPage() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in');
  const club = await publicCaller.auth.emptyClub();
  const teamsFull = await getUserLichessTeams(user.username);
  const teams = teamsFull.map((el) => ({
    label: el.name.toLowerCase(),
    value: el.id,
  }));

  return (
    <div>
      {club ? (
        <ForwardToEmptyClub club={club} />
      ) : (
        <NewClubForm user={user} teams={teams} />
      )}
    </div>
  );
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/clubs/create',
    title: t('clubs.create.title'),
    description: t('clubs.create.description'),
    robots: { index: false, follow: true },
  });
}
