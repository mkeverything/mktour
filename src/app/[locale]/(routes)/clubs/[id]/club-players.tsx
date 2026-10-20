import {
  PanelHeader,
  PanelScroller,
  usePanelScroller,
} from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import {
  leaderboardColumns,
  leaderboardFeatures,
} from '@/app/[locale]/(routes)/clubs/[id]/club-players-columns';
import Empty from '@/components/empty';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useDebounce } from '@/components/hooks/use-debounce';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import Paginator from '@/components/ui-custom/paginator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  CLUB_PLAYERS_DEFAULT_SORT,
  ClubPlayersSortModel,
} from '@/server/zod/players';
import { useQuery } from '@tanstack/react-query';
import { SortingState, useTable } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, useMemo, useState } from 'react';

export const PlayersPanel: FC<{ clubId: string; userId: string }> = ({
  clubId,
  userId,
}) => {
  const t = useTranslations();
  const trpc = useTRPC();
  const { data: stats } = useClubStats(clubId);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
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
    search: debouncedSearch || undefined,
  });
  const { data: me } = useQuery(
    trpc.club.authPlayer.queryOptions({ clubId }, { enabled: Boolean(userId) }),
  );

  const { scrollerRef, paginatorRoot } = usePanelScroller();

  // the table keeps showing the previous order until the new one arrives
  const [shownSorting, setShownSorting] = useState(sorting);
  if (!playersInfinite.isPlaceholderData && shownSorting !== sorting) {
    setShownSorting(sorting);
  }

  const isSearching = debouncedSearch.length > 0;
  const playersFromPages = useMemo(
    () => playersInfinite.data?.pages.flatMap((p) => p.players) ?? [],
    [playersInfinite.data],
  );
  const meLoaded = Boolean(
    me && playersFromPages.some((player) => player.id === me.id),
  );
  const isMePinned = Boolean(
    me && !isSearching && playersInfinite.isSuccess && !meLoaded,
  );
  const players = useMemo(
    () => (me && isMePinned ? [...playersFromPages, me] : playersFromPages),
    [me, isMePinned, playersFromPages],
  );

  const table = useTable({
    features: leaderboardFeatures,
    columns: leaderboardColumns,
    data: players,
    manualSorting: true,
    enableSortingRemoval: false,
    onSortingChange: setSorting,
    state: { sorting },
    meta: {
      isSortPending: shownSorting !== sorting,
      sortBy: shownSorting[0].id as ClubPlayersSortModel['sortBy'],
      pinnedPlayerId: isMePinned ? me?.id : undefined,
    },
  });

  const rows = table.getRowModel().rows;
  // your own row stays last, below the next page's skeleton, so it never jumps while pages load
  const renderRow = (row: (typeof rows)[number]) => (
    <TableRow
      key={row.id}
      className={cn(
        row.original.id === me?.id &&
          'bg-muted hover:bg-muted sticky top-[calc(var(--club-sticky-top)+2rem)] -bottom-px z-10 font-medium',
      )}
    >
      {row.getAllCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn('p-0', cell.column.columnDef.meta?.className)}
        >
          {/* every cell links on its own: safari can't stretch one link over a <tr> */}
          <Link
            href={`/player/${row.original.id}`}
            tabIndex={cell.column.id === 'nickname' ? undefined : -1}
            className="block truncate px-1 py-2"
          >
            <table.FlexRender cell={cell} />
          </Link>
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <>
      <PanelHeader
        messageId="Club.Page.players"
        count={stats?.playersCount}
        search={search}
        setSearch={setSearch}
      />
      <PanelScroller ref={scrollerRef}>
        <Table className="border-separate border-spacing-0 [&_td]:border-b [&_th]:border-b">
          <TableHeader className="bg-background sticky top-(--club-sticky-top) z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
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
            {rows.slice(0, isMePinned ? -1 : undefined).map(renderRow)}
            {playersInfinite.isFetchingNextPage && <SkeletonRows />}
            {isMePinned && renderRow(rows[rows.length - 1])}
          </TableBody>
        </Table>
        {playersInfinite.isPending ? (
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
          hasNextPage={playersInfinite.hasNextPage}
          isFetchingNextPage={playersInfinite.isFetchingNextPage}
          fetchNextPage={playersInfinite.fetchNextPage}
          root={paginatorRoot}
          skeleton={null}
        />
      </PanelScroller>
    </>
  );
};

const SkeletonRows: FC = () =>
  Array.from({ length: 3 }, (_, i) => (
    <TableRow key={i} className="hover:bg-transparent">
      <TableCell colSpan={4} className="px-1 py-2">
        <Skeleton className="h-5 w-full" />
      </TableCell>
    </TableRow>
  ));
