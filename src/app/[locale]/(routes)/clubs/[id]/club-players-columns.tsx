import FormattedMessage from '@/components/formatted-message';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClubPlayerModel, ClubPlayersFilterModel } from '@/server/zod/players';
import {
  createColumnHelper,
  HeaderContext,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren } from 'react';

export const leaderboardFeatures = tableFeatures({
  rowSortingFeature,
  columnMeta: {} as { className: string },
  tableMeta: {} as {
    isSortPending: boolean;
    sortBy: ClubPlayersFilterModel['sortBy'];
  },
});

const leaderboardColumnHelper = createColumnHelper<
  typeof leaderboardFeatures,
  ClubPlayerModel
>();

export const leaderboardColumns = leaderboardColumnHelper.columns([
  leaderboardColumnHelper.display({
    id: 'position',
    header: '#',
    cell: ({ row, table }) => {
      const meta = table.options.meta;
      // names have no stored ranks, so the list numbers its own rows
      if (meta?.sortBy === 'nickname') return row.index + 1;
      const rank =
        meta?.sortBy === 'tournamentsPlayed'
          ? row.original.tournamentsPlayedRank
          : row.original.ratingRank;
      return rank ?? '—';
    },
    meta: { className: 'text-muted-foreground w-[6ch] text-xs tabular-nums' },
  }),
  leaderboardColumnHelper.accessor('nickname', {
    header: (context) => (
      <SortableHead {...context}>
        <FormattedMessage id="Player.nickname" />
      </SortableHead>
    ),
    cell: ({ getValue }) => (
      <span className="block truncate">{getValue()}</span>
    ),
    meta: { className: 'w-full max-w-0' },
  }),
  leaderboardColumnHelper.accessor('rating', {
    header: (context) => (
      <SortableHead {...context}>
        <FormattedMessage id="Player.rating" />
      </SortableHead>
    ),
    cell: ({ row: { original } }) => (
      <span
        className={cn(
          'font-semibold',
          !original.isRatingEstablished && 'text-muted-foreground',
        )}
      >
        <NumericCell
          value={original.rating}
          mark={original.isRatingEstablished ? undefined : '?'}
        />
      </span>
    ),
    sortDescFirst: true,
    meta: { className: 'text-right tabular-nums' },
  }),
  leaderboardColumnHelper.accessor('tournamentsPlayed', {
    header: (context) => (
      <SortableHead {...context}>
        <TournamentsHead />
      </SortableHead>
    ),
    cell: ({ getValue }) => <NumericCell value={getValue()} />,
    sortDescFirst: true,
    meta: {
      className: 'text-muted-foreground text-right text-xs tabular-nums',
    },
  }),
]);

const SortableHead = <TValue,>({
  column,
  table,
  children,
}: PropsWithChildren<
  Pick<
    HeaderContext<typeof leaderboardFeatures, ClubPlayerModel, TValue>,
    'column' | 'table'
  >
>) => {
  const sorted = column.getIsSorted();
  const SortIcon =
    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        // the chip's padding sits in the cell's, so its label lines up with the values
        '-mx-2 h-7 gap-1 px-2 text-xs has-[>svg]:px-2',
        sorted && 'text-foreground',
      )}
      onClick={() => column.toggleSorting()}
    >
      {children}
      {sorted && table.options.meta?.isSortPending ? (
        <LoadingSpinner className="size-3" />
      ) : (
        <SortIcon className={cn('size-3', !sorted && 'opacity-40')} />
      )}
    </Button>
  );
};

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
