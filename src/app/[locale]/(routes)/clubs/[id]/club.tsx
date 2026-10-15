'use client';

import {
  DashboardButton,
  LichessTeamLink,
} from '@/app/[locale]/(routes)/clubs/[id]/club-shared';
import { ClubTournaments } from '@/app/[locale]/(routes)/clubs/tournaments';
import { turboPascal } from '@/app/fonts';
import Empty from '@/components/empty';
import FormattedMessage, {
  IntlMessageId,
} from '@/components/formatted-message';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useClubTournaments } from '@/components/hooks/query-hooks/use-club-tournaments';
import { useClubScopedSearch } from '@/components/hooks/use-club-scoped-search';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
import Paginator from '@/components/ui-custom/paginator';
import { ScrollArea } from '@/components/ui-custom/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ClubModel } from '@/server/zod/clubs';
import { StatusInClub } from '@/server/zod/enums';
import {
  CLUB_PLAYERS_DEFAULT_SORT,
  ClubPlayersSortModel,
  PlayerModel,
} from '@/server/zod/players';
import { TournamentModel } from '@/server/zod/tournaments';
import { useQuery } from '@tanstack/react-query';
import {
  Column,
  createColumnHelper,
  rowSortingFeature,
  SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Dot,
  Swords,
  Trophy,
  Users2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, PropsWithChildren, ReactNode, useMemo, useState } from 'react';

const ClubPage: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
  userId: string;
}> = ({ club, statusInClub, userId }) => {
  return (
    <div className="p-mk md:p-mk-2 gap-mk lg:h-mk-content-height flex w-full flex-col lg:overflow-hidden">
      <HeaderStrip club={club} statusInClub={statusInClub} />

      <div className="gap-mk-2 hidden min-h-0 flex-1 lg:flex">
        <div className="gap-mk flex min-h-0 min-w-0 flex-[5] flex-col">
          <LiveNowCarousel clubId={club.id} />
          <Section
            icon={Trophy}
            title={<FormattedMessage id="Menu.tournaments" />}
            className="flex-1"
          >
            <ClubTournaments clubId={club.id} statusInClub={statusInClub} />
          </Section>
        </div>
        <PlayersLeaderboard
          clubId={club.id}
          userId={userId}
          className="min-h-0 flex-[4]"
        />
      </div>

      <div className="gap-mk flex flex-col lg:hidden">
        <LiveNowCarousel clubId={club.id} />
        <Tabs defaultValue="tournaments" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tournaments">
              <FormattedMessage id="Menu.tournaments" />
            </TabsTrigger>
            <TabsTrigger value="players">
              <FormattedMessage id="Club.Page.players" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tournaments">
            <div className="h-[32rem] pt-2">
              <ClubTournaments clubId={club.id} statusInClub={statusInClub} />
            </div>
          </TabsContent>
          <TabsContent value="players">
            <PlayersLeaderboard
              clubId={club.id}
              userId={userId}
              className="h-[32rem] pt-2"
              hideHeading
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const HeaderStrip: FC<{
  club: ClubModel;
  statusInClub: StatusInClub | null;
}> = ({ club, statusInClub }) => {
  const t = useTranslations('Club');
  const tStatus = useTranslations('Status');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data: managers } = useQuery(
    trpc.club.managers.all.queryOptions({ clubId: club.id }),
  );

  return (
    <header className="gap-mk flex shrink-0 flex-wrap items-end justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-3">
          <h1
            className={cn(
              turboPascal.className,
              'truncate text-2xl leading-tight md:text-3xl',
            )}
          >
            {club.name}
          </h1>
          {club.lichessTeam && <LichessTeamLink team={club.lichessTeam} />}
        </div>
        {club.description && (
          <p className="text-muted-foreground max-w-prose text-sm lg:line-clamp-1">
            {club.description}
          </p>
        )}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {club.createdAt && (
            <span>
              {t('Page.createdAt', {
                date: club.createdAt.toLocaleDateString(locale, {
                  dateStyle: 'medium',
                }),
              })}
            </span>
          )}
          {managers && managers.length > 0 && (
            <>
              <span aria-hidden>·</span>
              {managers.map((manager) => (
                <Link
                  key={manager.user.id}
                  href={`/user/${manager.user.username}`}
                  className="hover:text-foreground transition-colors"
                >
                  {manager.user.username}
                  <span className="text-muted-foreground/60 ml-0.5">
                    ({tStatus(manager.clubs_to_users.status)})
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="gap-mk-2 flex items-center">
        <InlineStats clubId={club.id} />
        <DashboardButton clubId={club.id} statusInClub={statusInClub} />
      </div>
    </header>
  );
};

const InlineStats: FC<{ clubId: string }> = ({ clubId }) => {
  const { data: stats, isPending } = useClubStats(clubId);
  const t = useTranslations('Club.Stats');

  if (isPending) return <Skeleton className="h-8 w-32" />;
  return (
    <div className="gap-mk-2 flex items-baseline">
      <InlineStat
        value={stats?.tournamentsCount ?? 0}
        label={t('tournaments', { count: stats?.tournamentsCount ?? 0 })}
      />
      <InlineStat
        value={stats?.playersCount ?? 0}
        label={t('players', { count: stats?.playersCount ?? 0 })}
      />
    </div>
  );
};

const InlineStat: FC<{ value: number; label: string }> = ({ value, label }) => (
  <span className="flex items-baseline gap-1.5">
    <span className={cn(turboPascal.className, 'text-2xl leading-none')}>
      {value}
    </span>
    <span className="text-muted-foreground text-xs">{label}</span>
  </span>
);

const Section: FC<{
  icon: FC<{ className?: string }>;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ icon: Icon, title, className, children }) => (
  <section className={cn('flex min-h-0 min-w-0 flex-col', className)}>
    <div className="flex shrink-0 items-center gap-2 border-b pb-2">
      <Icon className="text-muted-foreground size-4" />
      <h2 className="text-sm font-medium">{title}</h2>
    </div>
    <div className="flex min-h-0 flex-1 flex-col pt-2">{children}</div>
  </section>
);

const LiveNowCarousel: FC<{ clubId: string }> = ({ clubId }) => {
  const { data } = useClubTournaments(clubId);
  const liveTournaments =
    data?.pages
      .flatMap((page) => page.tournaments)
      .filter((tournament) => tournament.startedAt && !tournament.closedAt) ??
    [];

  if (!liveTournaments.length) return null;
  return (
    <div className="gap-mk no-scrollbar flex shrink-0 snap-x overflow-x-auto">
      {liveTournaments.map((tournament) => (
        <LiveTournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  );
};

const LiveTournamentCard: FC<{ tournament: TournamentModel }> = ({
  tournament,
}) => {
  const t = useTranslations('Club.Page');
  const tTournament = useTranslations('MakeTournament');
  const fallbackTitle = useTournamentFallbackTitle(tournament);
  const title = tournament.title || fallbackTitle;
  const details = [
    tournament.rated ? tTournament('rated') : tTournament('unrated'),
    tTournament(tournament.format),
    tTournament(`Types.${tournament.type}`),
  ];

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="min-w-72 flex-1 snap-start"
    >
      <Card className="border-primary/15 bg-primary/5 p-mk-2 hover:bg-primary/10 flex h-full flex-col gap-1 transition-colors">
        <div className="flex items-center gap-2">
          <LiveDot />
          <span className="text-xs font-medium">{t('liveNow')}</span>
          {!!tournament.roundsNumber && (
            <span className="text-muted-foreground ml-auto text-xs">
              {t('roundOf', {
                round: tournament.ongoingRound,
                rounds: tournament.roundsNumber,
              })}
            </span>
          )}
        </div>
        <span className="truncate text-sm font-medium">{title}</span>
        <div className="text-muted-foreground flex flex-wrap items-center text-xs">
          {details.map((detail, i) => (
            <span key={i} className="flex items-center">
              {detail}
              {i !== details.length - 1 && <Dot className="size-4" />}
            </span>
          ))}
        </div>
      </Card>
    </Link>
  );
};

const LiveDot: FC = () => (
  <span className="relative flex size-2">
    <span className="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
    <span className="bg-destructive relative inline-flex size-2 rounded-full" />
  </span>
);

// per-player games and tournaments played are not in the players list
// payload yet; deterministic mocks until a server-side aggregate exists
const mockGamesPlayed = (rating: number) => (rating % 53) + 5;
const mockTournamentsPlayed = (rating: number) => (rating % 17) + 1;

const leaderboardFeatures = tableFeatures({
  rowSortingFeature,
  columnMeta: {} as { className: string },
});

const leaderboardColumnHelper = createColumnHelper<
  typeof leaderboardFeatures,
  PlayerModel
>();

const leaderboardColumns = leaderboardColumnHelper.columns([
  leaderboardColumnHelper.accessor('nickname', {
    header: ({ column }) => (
      <SortableHead column={column}>
        <FormattedMessage id="Player.nickname" />
      </SortableHead>
    ),
    cell: ({ row }) => (
      <Link
        href={`/player/${row.original.id}`}
        className="after:absolute after:inset-0"
      >
        {row.original.nickname}
      </Link>
    ),
    meta: { className: 'w-full max-w-0 truncate' },
  }),
  leaderboardColumnHelper.accessor('rating', {
    header: ({ column }) => (
      <SortableHead column={column}>
        <FormattedMessage id="Player.rating" />
      </SortableHead>
    ),
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
    sortDescFirst: true,
    meta: { className: 'text-right' },
  }),
  leaderboardColumnHelper.display({
    id: 'tournaments',
    header: () => (
      <StatHead icon={Trophy} messageId="Player.Stats.tournaments" />
    ),
    cell: ({ row }) => mockTournamentsPlayed(row.original.rating),
    meta: { className: 'text-muted-foreground min-w-10 text-right text-xs' },
  }),
  leaderboardColumnHelper.display({
    id: 'gamesPlayed',
    header: () => (
      <StatHead icon={Swords} messageId="Player.Stats.gamesPlayed" />
    ),
    cell: ({ row }) => mockGamesPlayed(row.original.rating),
    meta: { className: 'text-muted-foreground min-w-10 text-right text-xs' },
  }),
]);

const PlayersLeaderboard: FC<{
  clubId: string;
  userId: string;
  className?: string;
  hideHeading?: boolean;
}> = ({ clubId, userId, className, hideHeading }) => {
  const t = useTranslations();
  const trpc = useTRPC();
  const { data: stats } = useClubStats(clubId);
  const {
    data: searchResults,
    search,
    setSearch,
    debouncedSearch,
  } = useClubScopedSearch({ clubId, type: 'players' });
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: CLUB_PLAYERS_DEFAULT_SORT.sortBy,
      desc: CLUB_PLAYERS_DEFAULT_SORT.order === 'desc',
    },
  ]);
  const [{ id: sortBy, desc: isDesc }] = sorting;
  const playersInfinite = useClubPlayers(clubId, {
    sortBy: sortBy as ClubPlayersSortModel['sortBy'],
    order: isDesc ? 'desc' : 'asc',
  });
  const { data: me } = useQuery(
    trpc.club.authPlayer.queryOptions({ clubId }, { enabled: Boolean(userId) }),
  );

  const useSearch = debouncedSearch.length > 0;
  const isPending = !useSearch && playersInfinite.status === 'pending';
  const isRanked = !useSearch && sortBy === 'rating' && isDesc;
  const playersFromPages = useMemo(
    () => playersInfinite.data?.pages.flatMap((p) => p.players) ?? [],
    [playersInfinite.data],
  );
  const meLoaded = Boolean(
    me && playersFromPages.some((player) => player.id === me.id),
  );
  const players = useMemo(() => {
    if (useSearch) return searchResults?.players ?? [];
    return me && playersInfinite.isSuccess && !meLoaded
      ? [...playersFromPages, me]
      : playersFromPages;
  }, [
    useSearch,
    searchResults,
    me,
    playersInfinite.isSuccess,
    meLoaded,
    playersFromPages,
  ]);

  const table = useTable({
    features: leaderboardFeatures,
    columns: leaderboardColumns,
    data: players,
    manualSorting: true,
    enableSorting: !useSearch,
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      {!hideHeading && (
        <div className="mb-2 flex items-center gap-2 border-b pb-2">
          <Users2 className="text-muted-foreground size-4" />
          <h2 className="text-sm font-medium">
            <FormattedMessage id="Club.Page.players" />
          </h2>
        </div>
      )}
      <div className="pb-2">
        <ClubSearchInput search={search} setSearch={setSearch} />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                <TableHead className="h-8 w-8 px-1 text-xs">#</TableHead>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className={cn(
                        'h-8 px-1 text-xs',
                        header.column.columnDef.meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  'relative',
                  row.original.id === me?.id &&
                    'bg-muted hover:bg-muted sticky top-8 bottom-0 z-10 font-medium',
                )}
              >
                <TableCell className="text-muted-foreground px-1 py-1.5 text-xs">
                  {isRanked && row.index < playersFromPages.length
                    ? row.index + 1
                    : '—'}
                </TableCell>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'px-1 py-1.5',
                      cell.column.columnDef.meta?.className,
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {isPending ? (
          <SkeletonList length={8} className="h-8" />
        ) : (
          players.length === 0 && (
            <Empty className="text-center text-balance">
              {stats?.playersCount !== 0
                ? t('GlobalSearch.not found')
                : t('Empty.players')}
            </Empty>
          )
        )}
        <Paginator
          disabled={useSearch}
          hasNextPage={playersInfinite.hasNextPage}
          isFetchingNextPage={playersInfinite.isFetchingNextPage}
          fetchNextPage={playersInfinite.fetchNextPage}
          skeleton={<SkeletonList length={3} className="h-8" />}
        />
      </ScrollArea>
    </section>
  );
};

const SortableHead = <TValue,>({
  column,
  children,
}: PropsWithChildren<{
  column: Column<typeof leaderboardFeatures, PlayerModel, TValue>;
}>) => {
  const sorted = column.getIsSorted();
  if (!column.getCanSort()) return children;

  const SortIcon =
    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-mx-2 h-7 px-2 text-xs"
      onClick={() => column.toggleSorting()}
    >
      {children}
      <SortIcon className="size-3.5" />
    </Button>
  );
};

const StatHead: FC<{
  icon: FC<{ className?: string }>;
  messageId: IntlMessageId;
}> = ({ icon: Icon, messageId }) => {
  const t = useTranslations();
  return (
    <span className="flex justify-end" title={t(messageId)}>
      <Icon className="size-3.5" />
      <span className="sr-only">{t(messageId)}</span>
    </span>
  );
};

export default ClubPage;
