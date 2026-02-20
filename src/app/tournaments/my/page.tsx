import TournamentItemIteratee from '@/components/tournament-item';
import { publicCaller } from '@/server/api';
import getTournamentsToUserClubsQuery, {
  TournamentWithClubModel,
} from '@/server/queries/get-tournaments-to-user-clubs-query';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FC } from 'react';

export default async function MyTournaments() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/tournaments/my');
  const t = await getTranslations('Tournaments');
  const tournaments = await getTournamentsToUserClubsQuery({ user });

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
