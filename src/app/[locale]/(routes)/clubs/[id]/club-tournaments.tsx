import {
  PanelHeader,
  PanelScroller,
  usePanelScroller,
} from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import { MakeTournament } from '@/app/[locale]/(routes)/clubs/tournaments';
import Empty from '@/components/empty';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubTournaments } from '@/components/hooks/query-hooks/use-club-tournaments';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import SkeletonList from '@/components/skeleton-list';
import Paginator from '@/components/ui-custom/paginator';
import { localDateStringToDate } from '@/lib/local-date';
import { StatusInClub } from '@/server/zod/enums';
import { TournamentModel } from '@/server/zod/tournaments';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
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
  const { scrollerRef, paginatorRoot } = usePanelScroller();

  const useSearch = debouncedSearch.length > 0;
  const tournaments = useSearch
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
      <PanelScroller ref={scrollerRef}>
        {!useSearch && isPending && (
          <SkeletonList length={8} className="h-16" />
        )}
        {groupByMonth(tournaments).map(([month, monthTournaments]) => (
          <section key={month} className="not-first:mt-2">
            <MonthHeading month={month} />
            <div className="bg-card divide-y overflow-hidden rounded-xl border">
              {monthTournaments.map((tournament) => (
                <TournamentRow key={tournament.id} tournament={tournament} />
              ))}
            </div>
          </section>
        ))}
        {(useSearch || !isPending) && !tournaments.length && (
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
        <Paginator
          disabled={useSearch}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          root={paginatorRoot}
          skeleton={<SkeletonList length={3} className="mt-2 h-16" />}
        />
      </PanelScroller>
    </>
  );
};

const groupByMonth = (tournaments: TournamentModel[]) => {
  const months = new Map<string, TournamentModel[]>();
  for (const tournament of tournaments.toSorted((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const month = tournament.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), tournament]);
  }
  return [...months];
};

const MonthHeading: FC<{ month: string }> = ({ month }) => {
  const format = useFormatter();
  const date = localDateStringToDate(`${month}-01`);
  const isThisYear = date.getFullYear() === new Date().getFullYear();

  return (
    <h3 className="bg-background text-muted-foreground sticky top-(--club-sticky-top) z-10 flex h-8 items-center px-1 text-xs lowercase">
      {format.dateTime(date, {
        month: 'long',
        year: isThisYear ? undefined : 'numeric',
      })}
    </h3>
  );
};

const TournamentRow: FC<{ tournament: TournamentModel }> = ({ tournament }) => {
  const t = useTranslations('MakeTournament');
  const tPage = useTranslations('Club.Page');
  const format = useFormatter();
  const fallbackTitle = useTournamentFallbackTitle(tournament);
  const isLive = Boolean(tournament.startedAt && !tournament.closedAt);
  const details = [
    tournament.rated ? t('rated') : t('unrated'),
    t(tournament.format),
    t(`Types.${tournament.type}`),
  ];

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="hover:bg-muted/50 active:bg-muted flex items-start gap-4 px-4 py-3 transition-colors active:transition-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium break-words">
          {tournament.title || fallbackTitle}
        </span>
        <span className="text-muted-foreground text-xs">
          {details.join(' · ')}
        </span>
      </div>
      {isLive ? (
        <span className="shrink-0 text-xs">
          <span className="bg-destructive mr-1 inline-block size-1.5 animate-pulse rounded-full align-middle motion-reduce:animate-none" />
          {tPage('roundOf', {
            round: tournament.ongoingRound,
            rounds: tournament.roundsNumber,
          })}
        </span>
      ) : (
        <span className="text-muted-foreground shrink-0 text-xs lowercase tabular-nums">
          {format.dateTime(localDateStringToDate(tournament.date), {
            day: 'numeric',
            month: 'long',
          })}
        </span>
      )}
    </Link>
  );
};
