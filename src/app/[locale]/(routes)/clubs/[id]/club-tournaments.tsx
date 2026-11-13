import {
  PanelHeader,
  PanelScroller,
} from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import { MakeTournament } from '@/app/[locale]/(routes)/clubs/tournaments';
import Empty from '@/components/empty';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubTournaments } from '@/components/hooks/query-hooks/use-club-tournaments';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import SkeletonList from '@/components/skeleton-list';
import {
  TournamentMonths,
  TournamentRow,
} from '@/components/tournament-months';
import { StatusInClub } from '@/server/zod/enums';
import { useTranslations } from 'next-intl';
import { FC } from 'react';

export const TournamentsPanel: FC<{
  clubId: string;
  statusInClub: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const t = useTranslations();
  const { data: stats } = useClubStats(clubId);
  const {
    data: searchResults,
    search,
    setSearch,
    debouncedSearch,
  } = useClubScopedSearch({ clubId, type: 'tournaments' });
  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useClubTournaments(clubId);

  const isSearching = debouncedSearch.length > 0;
  const tournaments = isSearching
    ? (searchResults?.tournaments ?? [])
    : (data?.pages.flatMap((page) => page.tournaments) ?? []);

  return (
    <>
      <PanelHeader
        messageId="Menu.tournaments"
        count={stats?.tournamentsCount}
        search={search}
        setSearch={setSearch}
      />
      <PanelScroller
        disabled={isSearching}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        skeleton={<SkeletonList length={3} className="mt-2 h-16" />}
      >
        {!isSearching && isPending && (
          <SkeletonList length={8} className="h-16" />
        )}
        <TournamentMonths items={tournaments} getDate={({ date }) => date}>
          {(tournament) => (
            <TournamentRow key={tournament.id} tournament={tournament} />
          )}
        </TournamentMonths>
        {(isSearching || !isPending) && !tournaments.length && (
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
      </PanelScroller>
    </>
  );
};
