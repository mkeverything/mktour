import FormattedMessage, {
  IntlMessageId,
} from '@/components/formatted-message';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClubPlayerModel } from '@/server/zod/players';
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
  tableMeta: {} as { isSortPending: boolean },
});

const leaderboardColumnHelper = createColumnHelper<
  typeof leaderboardFeatures,
  ClubPlayerModel
>();

export const leaderboardColumns = leaderboardColumnHelper.columns([
  leaderboardColumnHelper.accessor('position', {
    header: '#',
    enableSorting: false,
    meta: { className: 'text-muted-foreground w-[6ch] text-xs tabular-nums' },
  }),
  leaderboardColumnHelper.accessor('nickname', {
    header: (context) => (
      <SortableHead {...context}>
        <FormattedMessage id="Player.nickname" />
      </SortableHead>
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
          !original.isEstablished && 'text-muted-foreground',
        )}
      >
        {original.rating}
        <span className="inline-block w-[1ch] text-left">
          {!original.isEstablished && '?'}
        </span>
      </span>
    ),
    sortDescFirst: true,
    meta: { className: 'text-right tabular-nums' },
  }),
  leaderboardColumnHelper.accessor('tournamentsPlayed', {
    header: (context) => (
      <SortableHead {...context}>
        <StatHead icon={Trophy} messageId="Player.Stats.tournaments" />
      </SortableHead>
    ),
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
  if (!column.getCanSort()) return children;

  const SortIcon =
    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        '-mx-1 h-7 gap-1 px-1 text-xs',
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

const StatHead: FC<{
  icon: FC<{ className?: string }>;
  messageId: IntlMessageId;
}> = ({ icon: Icon, messageId }) => {
  const t = useTranslations();
  return (
    <span title={t(messageId)}>
      <Icon className="size-3.5" />
      <span className="sr-only">{t(messageId)}</span>
    </span>
  );
};
