import {
  PanelHeader,
  PanelScroller,
} from '@/app/[locale]/(routes)/clubs/[id]/club-panel';
import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useClubPlayers } from '@/components/hooks/query-hooks/use-club-players';
import { useClubStats } from '@/components/hooks/query-hooks/use-club-stats';
import { useDebounce } from '@/components/hooks/use-debounce';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import { Button } from '@/components/ui/button';
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
  ClubPlayerModel,
  ClubPlayersFilterModel,
} from '@/server/zod/players';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, PropsWithChildren, ReactNode, useState } from 'react';

type Sort = Pick<ClubPlayersFilterModel, 'sortBy' | 'order'>;

// numbers end where their header's label does: the slot after them is as wide as the
// sort icon beside the label (gap-1 + size-3), and an unsure rating puts its ? there
const NumericCell: FC<{ value: number; mark?: string }> = ({ value, mark }) => (
  <>
    {value}
    <span className="inline-block w-4 text-left">{mark}</span>
  </>
);

const TournamentsHead: FC = () => {
  const t = useTranslations('Player.Stats');
  return (
    <span title={t('tournaments')}>
      <Trophy className="size-3.5" />
      <span className="sr-only">{t('tournaments')}</span>
    </span>
  );
};

const COLUMNS: {
  head: ReactNode;
  firstSort?: Sort;
  className: string;
  cell: (
    player: ClubPlayerModel,
    index: number,
    sortBy: Sort['sortBy'],
  ) => ReactNode;
}[] = [
  {
    head: '#',
    className: 'text-muted-foreground w-[6ch] text-xs tabular-nums',
    // names have no stored ranks, so the list numbers its own rows
    cell: (player, index, sortBy) => {
      if (sortBy === 'nickname') return index + 1;
      const rank =
        sortBy === 'tournamentsPlayed'
          ? player.tournamentsPlayedRank
          : player.ratingRank;
      return rank ?? '—';
    },
  },
  {
    head: <FormattedMessage id="Player.nickname" />,
    firstSort: { sortBy: 'nickname', order: 'asc' },
    className: 'w-full max-w-0',
    cell: (player) => <span className="block truncate">{player.nickname}</span>,
  },
  {
    head: <FormattedMessage id="Player.rating" />,
    firstSort: { sortBy: 'rating', order: 'desc' },
    className: 'text-right tabular-nums',
    cell: (player) => (
      <span
        className={cn(
          'font-semibold',
          !player.isRatingEstablished && 'text-muted-foreground',
        )}
      >
        <NumericCell
          value={player.rating}
          mark={player.isRatingEstablished ? undefined : '?'}
        />
      </span>
    ),
  },
  {
    head: <TournamentsHead />,
    firstSort: { sortBy: 'tournamentsPlayed', order: 'desc' },
    className: 'text-muted-foreground text-right text-xs tabular-nums',
    cell: (player) => <NumericCell value={player.tournamentsPlayed} />,
  },
];

export const PlayersPanel: FC<{ clubId: string; userId?: string }> = ({
  clubId,
  userId,
}) => {
  const t = useTranslations();
  const trpc = useTRPC();
  const { data: stats } = useClubStats(clubId);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sort, setSort] = useState<Sort>(CLUB_PLAYERS_DEFAULT_SORT);
  const playersInfinite = useClubPlayers(clubId, {
    ...sort,
    search: debouncedSearch || undefined,
  });
  const { data: authPlayer } = useQuery(
    trpc.club.authPlayer.queryOptions({ clubId }, { enabled: Boolean(userId) }),
  );

  // the table keeps showing the previous order until the new one arrives
  const [shownSort, setShownSort] = useState(sort);
  if (!playersInfinite.isPlaceholderData && shownSort !== sort) {
    setShownSort(sort);
  }

  // names carry no standing, so the auth player is pinned and sticky only in ranked orders
  const isRankedOrder = shownSort.sortBy !== 'nickname';
  const isSearching = debouncedSearch.length > 0;
  const players =
    playersInfinite.data?.pages.flatMap((page) => page.players) ?? [];
  const pinnedPlayer =
    authPlayer &&
    isRankedOrder &&
    !isSearching &&
    playersInfinite.isSuccess &&
    !players.some((player) => player.id === authPlayer.id)
      ? authPlayer
      : null;

  const toggleSort = (firstSort: Sort) => {
    setSort((current) => {
      if (current.sortBy !== firstSort.sortBy) return firstSort;
      return { ...current, order: current.order === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderRow = (player: ClubPlayerModel, index: number) => (
    <TableRow
      key={player.id}
      className={cn(
        player.id === authPlayer?.id && [
          '*:bg-muted font-medium',
          // the cells stick, not the row: firefox stops painting a sticky <tr>
          isRankedOrder &&
            '*:sticky *:top-[calc(var(--club-sticky-top)+2rem)] *:-bottom-px *:z-10',
        ],
      )}
    >
      {COLUMNS.map(({ firstSort, className, cell }, columnIndex) => (
        <TableCell key={columnIndex} className={cn('p-0', className)}>
          {/* every cell links on its own: safari can't stretch one link over a <tr> */}
          <Link
            href={`/player/${player.id}`}
            tabIndex={firstSort?.sortBy === 'nickname' ? undefined : -1}
            className="block p-2"
          >
            {cell(player, index, shownSort.sortBy)}
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
      <PanelScroller
        hasNextPage={playersInfinite.hasNextPage}
        isFetchingNextPage={playersInfinite.isFetchingNextPage}
        fetchNextPage={playersInfinite.fetchNextPage}
        skeleton={null}
      >
        <Table className="border-separate border-spacing-0 [&_td]:border-b [&_th]:border-b">
          <TableHeader className="bg-background sticky top-(--club-sticky-top) z-20">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map(({ head, firstSort, className }, columnIndex) => {
                const order =
                  firstSort?.sortBy === sort.sortBy ? sort.order : undefined;
                return (
                  <TableHead
                    key={columnIndex}
                    aria-sort={
                      order && (order === 'asc' ? 'ascending' : 'descending')
                    }
                    className={cn('h-8 text-xs', className)}
                  >
                    {firstSort ? (
                      <SortButton
                        order={order}
                        isPending={shownSort !== sort}
                        onClick={() => toggleSort(firstSort)}
                      >
                        {head}
                      </SortButton>
                    ) : (
                      head
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map(renderRow)}
            {/* the pinned auth player stays last, below the next page's skeleton, so it never jumps while pages load */}
            {playersInfinite.isFetchingNextPage && <SkeletonRows />}
            {pinnedPlayer && renderRow(pinnedPlayer, players.length)}
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
      </PanelScroller>
    </>
  );
};

const SortButton: FC<
  PropsWithChildren<{
    order?: Sort['order'];
    isPending: boolean;
    onClick: () => void;
  }>
> = ({ order, isPending, onClick, children }) => {
  const SortIcon =
    order === 'asc' ? ArrowUp : order === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        // the chip's padding sits in the cell's, so its label lines up with the values
        '-mx-2 h-7 gap-1 px-2 text-xs has-[>svg]:px-2',
        order && 'text-foreground',
      )}
      onClick={onClick}
    >
      {children}
      {order && isPending ? (
        <LoadingSpinner className="size-3" />
      ) : (
        <SortIcon className={cn('size-3', !order && 'opacity-40')} />
      )}
    </Button>
  );
};

const SkeletonRows: FC = () =>
  Array.from({ length: 3 }, (_, i) => (
    <TableRow key={i} className="hover:bg-transparent">
      <TableCell colSpan={COLUMNS.length}>
        <Skeleton className="h-5 w-full" />
      </TableCell>
    </TableRow>
  ));
