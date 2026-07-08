import {
  Medal,
  medalColour,
} from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import FormattedMessage, {
  IntlMessageId,
} from '@/components/formatted-message';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UnitModel } from '@/server/zod/tournaments';
import { UserModel } from '@/server/zod/users';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, Scale, Trophy, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren, ReactNode } from 'react';

import { Stat } from './column-types';

export const UnitTableRow: FC<{
  canSort: boolean;
  index: number;
  unit: UnitModel;
  stats: Stat[];
  user: UserModel | null | undefined;
  hasEnded: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  renderStat: Record<Stat, (unit: UnitModel) => ReactNode>;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  tableRowRef?: React.Ref<HTMLTableRowElement>;
  dragHandleRef?: React.Ref<HTMLDivElement>;
  isOverlay?: boolean;
}> = ({
  canSort,
  index,
  unit,
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
        unit.players.some((member) => member.userId === user?.id)
          ? 'bg-card/50 font-bold'
          : '',
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
      {!canSort && (
        <TableCell className="font-small w-6 text-center">
          <Place unit={unit} hasEnded={hasEnded}>
            {index + 1}
          </Place>
        </TableCell>
      )}
      <TableCellStyled className="font-small w-full max-w-0 min-w-10 truncate pl-2">
        <Status unit={unit} user={user}>
          {unit.unitNickname}
        </Status>
      </TableCellStyled>
      {stats.map((stat) => (
        <StatCell key={stat} isOverlay={isOverlay} stat={stat}>
          {renderStat[stat](unit)}
        </StatCell>
      ))}
    </TableRow>
  );
};

export const SortableUnitTableRow: FC<{
  canSort: boolean;
  index: number;
  unit: UnitModel;
  stats: Stat[];
  user: UserModel | null | undefined;
  hasEnded: boolean;
  isSelected: boolean;
  onSelect: () => void;
  renderStat: Record<Stat, (unit: UnitModel) => ReactNode>;
}> = (props) => {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: props.unit.id,
    index: props.index,
    disabled: !props.canSort,
  });

  return (
    <UnitTableRow
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
        <TableHeader className="bg-background/50 sticky top-0 backdrop-blur-md">
          <TableRow>
            <TableHead className="w-8 min-w-8 text-center">
              {canSort ? '' : '#'}
            </TableHead>
            <TableHead className="w-full min-w-10 p-0 pl-2">
              <FormattedMessage id="Player.name" />
            </TableHead>
            <TableStatsHeads stats={stats} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(20)
            .fill(0)
            .map((_, i) => (
              <TableRow key={i}>
                <TableCell className="w-4">
                  <Skeleton className="size-4 rounded-sm" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-full max-w-60" />
                </TableCell>
                {Array(stats.length)
                  .fill(0)
                  .map((_, j) => (
                    <TableCell
                      key={j}
                      className="min-w-8 text-center font-medium"
                    >
                      <Skeleton className="mx-auto size-4 rounded-sm" />
                    </TableCell>
                  ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
};

const Place: FC<{ unit: UnitModel; hasEnded: boolean } & PropsWithChildren> = ({
  unit,
  hasEnded,
  children,
}) => {
  const place = unit.place;

  if (!place || !hasEnded) return children;

  return place > 3 ? (
    place
  ) : (
    <Medal className={`${medalColour[place - 1]} size-4`} />
  );
};

const Status: FC<
  {
    unit: UnitModel;
    user: UserModel | null | undefined;
  } & PropsWithChildren
> = ({ unit, children }) => {
  const unitMembers = unit.players;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div
        className={`gap-mk flex min-w-0 items-center ${unit.isOut && 'text-muted-foreground line-through'}`}
      >
        <span className="truncate">{children}</span>
        {unit.players.some((member) => member.userId) && (
          <UserRound className="text-muted-foreground size-4 shrink-0" />
        )}
      </div>
      {unitMembers.length > 1 && (
        <small className="text-muted-foreground text-2xs truncate">
          {unitMembers.map((member) => member.nickname).join(', ')}
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
