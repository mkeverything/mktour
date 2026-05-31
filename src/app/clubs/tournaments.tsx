import { ClubTabProps } from '@/app/clubs/my/tabMap';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubTournaments } from '@/components/hooks/query-hooks/use-club-tournaments';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import SkeletonList from '@/components/skeleton-list';
import TournamentItemIteratee from '@/components/tournament-item';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusInClub } from '@/server/zod/enums';
import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const ClubDashboardTournaments: FC<ClubTabProps> = ({
  selectedClub,
  statusInClub,
}) => {
  return <ClubTournaments clubId={selectedClub} statusInClub={statusInClub} />;
};

export const ClubTournamentsSection: FC<{
  clubId: string;
  statusInClub: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const { data: stats } = useClubStats(clubId);

  return (
    <Card className="flex h-[32rem] flex-col">
      <CardHeader className="shadow-card z-10 pb-0 shadow-md">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4" />
          <FormattedMessage id="Menu.tournaments" />
          <span className="text-muted-foreground font-normal">
            ({stats?.tournamentsCount ?? 0})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pt-3">
        <ClubTournaments clubId={clubId} statusInClub={statusInClub} />
      </CardContent>
    </Card>
  );
};

const ClubTournaments: FC<{
  clubId: string;
  statusInClub?: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const t = useTranslations();
  const { data: stats } = useClubStats(clubId);
  const {
    data: searchResults,
    search,
    setSearch,
    debouncedSearch,
  } = useClubScopedSearch({
    clubId,
    type: 'tournaments',
  });
  const {
    data: tournamentsPage,
    isLoading,
    isError,
    failureReason,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useClubTournaments(clubId);

  const useSearch = debouncedSearch.length > 0;

  const tournamentsFromPage =
    tournamentsPage?.pages.flatMap((p) => p.tournaments) ?? [];

  const tournaments = useSearch
    ? (searchResults?.tournaments ?? [])
    : tournamentsFromPage;

  if (!useSearch && isLoading) return <SkeletonList length={10} />;
  if (!useSearch && isError)
    return <p className="w-full">{failureReason?.message}</p>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="pb-2">
        <ClubSearchInput search={search} setSearch={setSearch} />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mk-list">
          {!tournaments.length && (
            <div className="flex flex-col items-center">
              <Empty className="text-center text-balance">
                {stats?.tournamentsCount !== 0
                  ? t('GlobalSearch.not found')
                  : t('Empty.tournaments')}
              </Empty>
              {statusInClub && stats?.tournamentsCount === 0 && (
                <MakeTournament />
              )}
            </div>
          )}
          {tournaments.map((props) => (
            <TournamentItemIteratee key={props.id} tournament={props} />
          ))}
          <Paginator
            disabled={useSearch}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            skeleton={<SkeletonList card length={3} />}
          />
        </div>
      </ScrollArea>
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
