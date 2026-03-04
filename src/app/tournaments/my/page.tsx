import TournamentItemIteratee from '@/components/tournament-item';
import { publicCaller } from '@/server/api';
import { TournamentWithClubModel } from '@/server/zod/tournaments';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata, ResolvingMetadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FC } from 'react';

export default async function MyTournaments() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/tournaments/my');
  const t = await getTranslations('Tournaments');
  const tournaments = await publicCaller.auth.myTournaments();

  if (!tournaments.length) {
    return (
      <p className="text-muted-foreground mk-container flex flex-col pt-4 text-center text-sm text-balance">
        {t('no tournaments')}
        <Link
          href={'/tournaments/create'}
          className="bg-primary text-secondary m-4 rounded-md p-2"
        >
          {t('make tournament')}
        </Link>
      </p>
    );
  }

  return (
    <main className="mk-container mk-list">
      <TournamentGroups props={tournaments} />
    </main>
  );
}

const TournamentGroups: FC<{ props: TournamentWithClubModel[] }> = ({
  props,
}) => {
  const groupedTournaments = getGroupedTournaments(props);

  return Object.entries(groupedTournaments).map(
    ([clubId, { clubName, tournaments }]) => {
      return (
        <div className="mk-list pb-0" key={clubId}>
          <Link href={`/clubs/${clubId}`} className="pl-mk text-sm">
            <h2 className="text-muted-foreground">{clubName}</h2>
          </Link>
          {tournaments.map(({ tournament }) => (
            <TournamentItemIteratee
              key={tournament.id}
              tournament={tournament}
            />
          ))}
        </div>
      );
    },
  );
};

const getGroupedTournaments = (props: TournamentWithClubModel[]) =>
  props.reduce(
    (acc, curr) => {
      const { id: clubId, name: clubName } = curr.club;
      if (!acc[clubId]) {
        acc[clubId] = {
          clubName,
          tournaments: [],
        };
      }
      acc[clubId].tournaments.push(curr);
      return acc;
    },
    {} as Record<
      string,
      { clubName: string; tournaments: TournamentWithClubModel[] }
    >,
  );

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/tournaments/my`;
  const previous = await parent;

  return {
    title: t('tournaments.my.title'),
    description: t('tournaments.my.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('tournaments.my.title'),
      description: t('tournaments.my.description'),
      url,
    },
  };
}
