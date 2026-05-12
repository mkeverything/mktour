'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import {
  STATS_WITH_TIEBREAK,
  type Stat,
} from '@/app/tournaments/[id]/dashboard/tabs/table/column-types';
import UnitDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/unit-drawer';
import {
  UnitTableRow,
  SortableUnitTableRow,
  TableLoading,
  TableStatsHeads,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-ui';
import { useSortableUnitTable } from '@/app/tournaments/[id]/dashboard/tabs/table/use-sortable-unit-table';
import { useTournamentRemoveUnit } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-remove-unit';
import { useTournamentWithdrawUnit } from '@/components/hooks/mutation-hooks/use-tournament-withdraw-unit';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentScoringInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  sortUnitsByResultsWithMaps,
  type SortedUnitsResult,
} from '@/lib/tournament-results';
import { UnitModel } from '@/server/zod/tournaments';
import { UserModel } from '@/server/zod/users';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  memo,
  useContext,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';

const TournamentTable = () => {
  const { id } = useParams<{ id: string }>();
  const units = useTournamentUnits(id);
  const tournament = useTournamentScoringInfo(id);
  const { status, userId } = useContext(DashboardContext);
  const removeUnit = useTournamentRemoveUnit(id);
  const withdrawUnit = useTournamentWithdrawUnit(id);
  const t = useTranslations('Tournament.Table');
  const [selectedUnit, setSelectedUnit] = useState<UnitModel | null>(null);
  const hasStarted = !!tournament.data?.startedAt;
  const hasEnded = !!tournament.data?.closedAt;
  const { data: user } = useAuth();
  const type = tournament.data?.type;
  const allGames = useTournamentGames(id);
  const stats = STATS_WITH_TIEBREAK;
  const canSort = status === 'organizer' && !hasStarted;

  const {
    units: sortedUnits,
    unitScoresMap: unitScoresMap,
    tiebreakScoresMap,
  } = useMemo<SortedUnitsResult>(() => {
    if (!units.data || !tournament.data) {
      return {
        units: [],
        unitScoresMap: new Map(),
        tiebreakScoresMap: new Map(),
      };
    }

    const tournamentForScoring = {
      format: tournament.data.format,
      ongoingRound: hasStarted ? tournament.data.ongoingRound : 0,
    };

    return sortUnitsByResultsWithMaps(
      units.data,
      tournamentForScoring,
      allGames.data ?? [],
    );
  }, [allGames.data, hasStarted, units.data, tournament.data]);

  const statRenderers = useMemo<Record<Stat, (unit: UnitModel) => ReactNode>>(
    () => ({
      wins: (unit) => unit.wins,
      draws: (unit) => unit.draws,
      losses: (unit) => unit.losses,
      score: (unit) => unitScoresMap.get(unit.id),
      tiebreak: (unit) => (
        <span className="text-muted-foreground">
          {tiebreakScoresMap.get(unit.id)}
        </span>
      ),
    }),
    [unitScoresMap, tiebreakScoresMap],
  );

  const { activeUnit, activeUnitId, handleDragStart, handleDragEnd } =
    useSortableUnitTable(sortedUnits, canSort);

  if (
    units.isLoading ||
    tournament.isLoading ||
    (hasStarted && allGames.isLoading)
  ) {
    return <TableLoading canSort={canSort} stats={stats} />;
  }

  if (units.isError) {
    toast.error(t('added players error'), {
      id: 'query-added-players',
      duration: 3000,
    });
    return <TableLoading canSort={canSort} stats={stats} />;
  }

  const handleDelete = () => {
    if (userId && status === 'organizer' && !hasStarted && selectedUnit) {
      removeUnit.mutate(
        {
          tournamentId: id,
          unitId: selectedUnit.id,
          userId,
        },
        { onSuccess: () => setSelectedUnit(null) },
      );
    }
  };

  const handleWithdraw = () => {
    if (
      userId &&
      status === 'organizer' &&
      hasStarted &&
      !hasEnded &&
      tournament.data?.format === 'swiss' &&
      selectedUnit &&
      !selectedUnit.isOut
    ) {
      withdrawUnit.mutate(
        {
          tournamentId: id,
          unitId: selectedUnit.id,
          userId,
        },
        { onSuccess: () => setSelectedUnit(null) },
      );
    }
  };

  const nameColumnIntl = type !== 'solo' ? 'name column team' : 'name column';

  return (
    <div className="mb-20 w-full">
      <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Table className="pt-0">
          <TableHeader className="bg-background/50 sticky top-0 backdrop-blur-md">
            <TableRow>
              {canSort && <TableHead className="w-6">&nbsp;</TableHead>}
              <TableHead className="h-11 w-6 p-0 text-center">#</TableHead>
              <TableHead className="h-11 w-full min-w-10 p-0">
                {t.rich(nameColumnIntl, {
                  count: units.data?.length ?? 0,
                  small: (chunks) =>
                    !!units.data?.length && <small>{chunks}</small>,
                })}
              </TableHead>
              <TableStatsHeads stats={stats} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUnits.map((unit, index) => (
              <SortableUnitRow
                key={unit.id}
                canSort={canSort}
                hasEnded={hasEnded}
                index={index}
                isSelected={selectedUnit?.id === unit.id}
                unit={unit}
                renderStat={statRenderers}
                setSelectedUnit={setSelectedUnit}
                stats={stats}
                user={user}
              />
            ))}
          </TableBody>
        </Table>
        <DragOverlay dropAnimation={null}>
          {activeUnit ? (
            <Table className="bg-background">
              <TableBody>
                <UnitTableRow
                  canSort={canSort}
                  hasEnded={hasEnded}
                  index={
                    activeUnitId
                      ? sortedUnits.findIndex(
                          (unit) => unit.id === activeUnitId,
                        )
                      : 0
                  }
                  unit={activeUnit}
                  renderStat={statRenderers}
                  stats={stats}
                  user={user}
                  isOverlay
                />
              </TableBody>
            </Table>
          ) : null}
        </DragOverlay>
      </DragDropProvider>
      {selectedUnit && (
        <UnitDrawer
          key={selectedUnit.id}
          unit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
          handleDelete={handleDelete}
          handleWithdraw={handleWithdraw}
          hasStarted={hasStarted}
          hasEnded={hasEnded}
          format={tournament.data?.format ?? 'swiss'}
        />
      )}
    </div>
  );
};

const SortableUnitRow = memo(function SortableUnitRow({
  canSort,
  hasEnded,
  index,
  isSelected,
  unit,
  renderStat,
  setSelectedUnit,
  stats,
  user,
}: {
  canSort: boolean;
  hasEnded: boolean;
  index: number;
  isSelected: boolean;
  unit: UnitModel;
  renderStat: Record<Stat, (unit: UnitModel) => ReactNode>;
  setSelectedUnit: Dispatch<SetStateAction<UnitModel | null>>;
  stats: Stat[];
  user: UserModel | null | undefined;
}) {
  return (
    <SortableUnitTableRow
      canSort={canSort}
      hasEnded={hasEnded}
      index={index}
      isSelected={isSelected}
      onSelect={() => setSelectedUnit(unit)}
      unit={unit}
      renderStat={renderStat}
      stats={stats}
      user={user}
    />
  );
});

export default memo(TournamentTable);
