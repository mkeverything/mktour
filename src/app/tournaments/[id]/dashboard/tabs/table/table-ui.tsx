import {
  Medal,
  medalColour,
} from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import FormattedMessage, {
  IntlMessageId,
} from '@/components/formatted-message';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlayerTournamentModel } from '@/server/zod/players';
import { UserModel } from '@/server/zod/users';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, Scale, Trophy, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren, ReactNode } from 'react';

import { Stat } from './column-types';

export const PlayerTableRow: FC<{
  canSort: boolean;
  index: number;
  player: PlayerTournamentModel;
  stats: Stat[];
  user: UserModel | null | undefined;
  hasEnded: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  renderStat: Record<Stat, (player: PlayerTournamentModel) => ReactNode>;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  tableRowRef?: React.Ref<HTMLTableRowElement>;
  dragHandleRef?: React.Ref<HTMLDivElement>;
  isOverlay?: boolean;
}> = ({
  canSort,
  index,
  player,
  stats,
  user,
  hasEnded,
  isSelected,
  onSelect,
  renderStat,
  isDragSource,
  isDropTarget,
  tableRowRef,
  dragHandleRef,
  isOverlay,
}) => {
  const t = useTranslations('Tournament.Table');

  return (
    <TableRow
      ref={tableRowRef}
      onClick={onSelect}
      className={[
        player.username === user?.username ? 'bg-card/50 font-bold' : '',
        isSelected ? 'bg-card/70' : '',
        canSort ? 'cursor-default' : '',
        isDragSource ? 'opacity-30' : '',
        isDropTarget ? 'ring-ring/40 ring-1 ring-inset' : '',
        isOverlay
          ? 'bg-background ring-border scale-[1.01] cursor-grabbing shadow-xl ring-1 backdrop-blur-2xl transition-transform sm:scale-none'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {canSort && (
        <TableCellStyled className="font-small w-4 py-1 pr-0 pl-1 text-center">
          <div
            ref={dragHandleRef}
            className={`text-muted-foreground hover:text-foreground inline-flex size-full items-center justify-center px-1 py-2 ${isOverlay ? 'cursor-grabbing' : 'hover:cursor-grab'}`}
          >
            <GripVertical className="size-3.5" />
            <span className="sr-only">{t('reorder')}</span>
          </div>
        </TableCellStyled>
      )}
      <TableCell className="font-small w-6 text-center">
        <Place player={player} hasEnded={hasEnded}>
          {index + 1}
        </Place>
      </TableCell>
      <TableCellStyled className="font-small w-full max-w-0 min-w-10 truncate pl-0">
        <Status player={player} user={user}>
          {player.nickname}
        </Status>
      </TableCellStyled>
      {stats.map((stat) => (
        <StatCell key={stat} isOverlay={isOverlay} stat={stat}>
          {renderStat[stat](player)}
        </StatCell>
      ))}
    </TableRow>
  );
};

export const SortableTableRow: FC<{
  canSort: boolean;
  index: number;
  player: PlayerTournamentModel;
  stats: Stat[];
  user: UserModel | null | undefined;
  hasEnded: boolean;
  isSelected: boolean;
  onSelect: () => void;
  renderStat: Record<Stat, (player: PlayerTournamentModel) => ReactNode>;
}> = (props) => {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: props.player.id,
    index: props.index,
    disabled: !props.canSort,
  });

  return (
    <PlayerTableRow
      {...props}
      tableRowRef={ref}
      dragHandleRef={handleRef}
      isDragSource={isDragSource}
      isDropTarget={isDropTarget}
    />
  );
};

export const TableStatsHeads: FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <>
      {stats.map((stat) => (
        <TableHeadStyled key={stat} className="text-center">
          {statHeadRenderers[stat]}
        </TableHeadStyled>
      ))}
    </>
  );
};

export const TableLoading: FC<{ canSort: boolean; stats: Stat[] }> = ({
  canSort,
  stats,
}) => {
  return (
    <div className="h-full w-full items-center justify-center overflow-hidden">
      <span className="sr-only">
        <FormattedMessage id="Tournament.Table.loading" />
      </span>
      <Table>
        <TableHeader>
          <TableRow>
            {canSort && <TableHead className="w-6">&nbsp;</TableHead>}
            <TableHeadStyled className="text-center">#</TableHeadStyled>
            <TableHeadStyled className="w-full min-w-10 p-0">
              <FormattedMessage id="Player.name" />
            </TableHeadStyled>
            <TableStatsHeads stats={stats} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(20)
            .fill(0)
            .map((_, i) => (
              <TableRow key={i}>
                {canSort && (
                  <TableCellStyled className="w-6">
                    <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                  </TableCellStyled>
                )}
                <TableCellStyled className="font-small w-10 text-center">
                  <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                </TableCellStyled>
                <TableCellStyled className="font-small max-w-0 truncate pl-0">
                  <div className="bg-muted h-4 w-40 animate-pulse rounded" />
                </TableCellStyled>
                {Array(stats.length)
                  .fill(0)
                  .map((_, j) => (
                    <TableCellStyled
                      key={j}
                      className="min-w-8 text-center font-medium"
                    >
                      <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                    </TableCellStyled>
                  ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
};

const Place: FC<
  { player: PlayerTournamentModel; hasEnded: boolean } & PropsWithChildren
> = ({ player, hasEnded, children }) => {
  const place = player.place;

  if (!place || !hasEnded) return children;

  return place > 3 ? (
    place
  ) : (
    <Medal className={`${medalColour[place - 1]} size-4`} />
  );
};

const Status: FC<
  {
    player: PlayerTournamentModel;
    user: UserModel | null | undefined;
  } & PropsWithChildren
> = ({ player, children }) => {
  const pairPlayers = player.pairPlayers ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div
        className={`gap-mk flex min-w-0 items-center ${player.isOut && 'text-muted-foreground line-through'}`}
      >
        <span className="truncate">{children}</span>
        {player.username && (
          <UserRound className="text-muted-foreground size-4 shrink-0" />
        )}
      </div>
      {pairPlayers.length === 2 && (
        <small className="text-muted-foreground text-2xs truncate">
          {pairPlayers[0].nickname}, {pairPlayers[1].nickname}
        </small>
      )}
    </div>
  );
};

const TableCellStyled: FC<PropsWithChildren & { className?: string }> = ({
  children,
  className,
}) => <TableCell className={`p-3 ${className}`}>{children}</TableCell>;

const TableHeadStyled: FC<PropsWithChildren & { className?: string }> = ({
  children,
  className,
}) => <TableHead className={`h-11 ${className}`}>{children}</TableHead>;

const StatCell: FC<
  PropsWithChildren & { isOverlay?: boolean; stat?: Stat }
> = ({ children, isOverlay, stat }) => {
  const isIcon = stat === 'score' || stat === 'tiebreak';
  const overlayWidth = isIcon ? '' : 'sm:min-w-16';

  return (
    <TableCellStyled
      className={`min-w-8 text-center font-medium ${isOverlay ? overlayWidth : ''}`}
    >
      {children}
    </TableCellStyled>
  );
};

const renderTextHead = (stat: Exclude<Stat, 'score' | 'tiebreak'>) => (
  <>
    <div className="block sm:hidden md:block xl:hidden">
      <FormattedMessage
        id={`Tournament.Table.Stats.short.${stat}` as IntlMessageId}
      />
    </div>
    <div className="hidden sm:block md:hidden xl:block">
      <FormattedMessage
        id={`Tournament.Table.Stats.full.${stat}` as IntlMessageId}
      />
    </div>
  </>
);

const statHeadRenderers: Record<Stat, React.ReactNode> = {
  wins: renderTextHead('wins'),
  draws: renderTextHead('draws'),
  losses: renderTextHead('losses'),
  score: <Trophy className="m-auto size-3.5" />,
  tiebreak: <Scale className="m-auto size-4" />,
};
