import { ClubTabProps } from '@/app/clubs/my/tabMap';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import TournamentItemIteratee from '@/components/tournament-item';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const ClubDashboardTournaments: FC<ClubTabProps> = ({
  selectedClub,
  statusInClub,
}) => {
  const t = useTranslations();
  const { data: stats } = useClubStats(selectedClub);
  const {
    data: searchResults,
    search,
    setSearch,
  } = useClubScopedSearch({
    clubId: selectedClub,
    type: 'tournaments',
  });

  return (
    <div className="mk-list">
      <ClubSearchInput search={search} setSearch={setSearch} />
      {searchResults?.tournaments?.map((props) => (
        <TournamentItemIteratee key={props.id} tournament={props} />
      ))}
      {!searchResults?.tournaments?.length && (
        <Empty className="text-center text-balance">
          {stats?.tournamentsCount !== 0
            ? t('GlobalSearch.not found')
            : t('Empty.tournaments')}
        </Empty>
      )}
      {statusInClub && stats?.tournamentsCount === 0 && <MakeTournament />}
    </div>
  );
};

const MakeTournament = () => (
  <Button size="lg" variant="default" asChild>
    <Link
      href="/tournaments/create"
      className="mt-4 flex items-center justify-center"
    >
      <FormattedMessage id="Home.make tournament" />
    </Link>
  </Button>
);

export default ClubDashboardTournaments;
