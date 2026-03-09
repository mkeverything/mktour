import { ClubTabProps } from '@/app/clubs/my/tabMap';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubTournaments } from '@/components/hooks/query-hooks/use-club-tournaments';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import SkeletonList from '@/components/skeleton-list';
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
    debouncedSearch,
  } = useClubScopedSearch({
    clubId: selectedClub,
    type: 'tournaments',
  });
  const {
    data: tournamentsPage,
    isLoading,
    isError,
    failureReason,
  } = useClubTournaments(selectedClub);

  const useSearch = debouncedSearch.length > 0;
  const tournaments = useSearch
    ? (searchResults?.tournaments ?? [])
    : (tournamentsPage ?? []);

  if (!useSearch && isLoading) return <SkeletonList length={10} />;
  if (!useSearch && isError)
    return <p className="w-full">{failureReason?.message}</p>;

  return (
    <div className="mk-list">
      <ClubSearchInput search={search} setSearch={setSearch} />
      {tournaments.map((props) => (
        <TournamentItemIteratee key={props.id} tournament={props} />
      ))}
      {!tournaments.length && (
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
