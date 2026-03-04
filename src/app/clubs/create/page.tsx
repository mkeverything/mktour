import ForwardToEmptyClub from '@/app/clubs/create/forward-to-empty-club';
import NewClubForm from '@/app/clubs/create/new-club-form';
import { getUserLichessTeams } from '@/lib/api/lichess';
import { publicCaller } from '@/server/api';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/clubs/create`;

  return {
    title: t('clubs.create.title'),
    description: t('clubs.create.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('clubs.create.title'),
      description: t('clubs.create.description'),
      url,
    },
  };
}
