'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import {
  STATS_WITH_TIEBREAK,
  type Stat,
} from '@/app/tournaments/[id]/dashboard/tabs/table/column-types';
import {
  SortableUnitTableRow,
  TableLoading,
  TableStatsHeads,
  UnitTableRow,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-ui';
import UnitDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/unit-drawer';
import { useSortableUnitTable } from '@/app/tournaments/[id]/dashboard/tabs/table/use-sortable-unit-table';
import { useTournamentPreStartLocked } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-pre-start-locked';
import { useTournamentRemoveUnit } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-remove-unit';
import { useTournamentWithdrawUnit } from '@/components/hooks/mutation-hooks/use-tournament-withdraw-unit';
import { useTournamentGames } from '@/components/hooks/query-hooks/use-tournament-games';
import { useTournamentScoringInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useIntlError } from '@/components/hooks/use-intl-error';
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
  const preStartLocked = useTournamentPreStartLocked(id);
  const t = useTranslations('Tournament.Table');
  const { translateError } = useIntlError();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const hasStarted = !!tournament.data?.startedAt;
  const hasEnded = !!tournament.data?.closedAt;
  const { data: user } = useAuth();
  const type = tournament.data?.type;
  const allGames = useTournamentGames(id);
  const stats = STATS_WITH_TIEBREAK;
  const canSort = status === 'organizer' && !hasStarted && !preStartLocked;

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

  const selectedUnit = useMemo(
    () =>
      selectedUnitId
        ? (sortedUnits.find((unit) => unit.id === selectedUnitId) ?? null)
        : null,
    [selectedUnitId, sortedUnits],
  );

  if (
    units.isLoading ||
    tournament.isLoading ||
    (hasStarted && allGames.isLoading)
  ) {
    return <TableLoading canSort={canSort} stats={stats} />;
  }

  if (units.isError) {
    toast.error(
      translateError(units.error, {
        fallback: 'TOURNAMENT_UNITS_NOT_LOADED',
      }),
      {
        id: 'TOURNAMENT_UNITS_NOT_LOADED',
        duration: 3000,
      },
    );
    return <TableLoading canSort={canSort} stats={stats} />;
  }

  const handleDelete = () => {
    if (
      userId &&
      status === 'organizer' &&
      !hasStarted &&
      !preStartLocked &&
      selectedUnit
    ) {
      removeUnit.mutate({
        tournamentId: id,
        unitId: selectedUnit.id,
        userId,
      });
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
      withdrawUnit.mutate({
        tournamentId: id,
        unitId: selectedUnit.id,
        userId,
      });
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
              {!canSort && (
                <TableHead className="h-11 min-w-6 p-0 text-center">
                  #
                </TableHead>
              )}
              <TableHead
                className={`h-11 w-full min-w-10 p-0 ${canSort ? 'pl-2' : ''}`}
              >
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
                isSelected={selectedUnitId === unit.id}
                unit={unit}
                renderStat={statRenderers}
                setSelectedUnitId={setSelectedUnitId}
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
          onClose={() => setSelectedUnitId(null)}
          handleDelete={handleDelete}
          handleWithdraw={handleWithdraw}
          hasStarted={hasStarted}
          hasEnded={hasEnded}
          format={tournament.data?.format ?? 'swiss'}
          preStartLocked={preStartLocked}
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
  setSelectedUnitId,
  stats,
  user,
}: {
  canSort: boolean;
  hasEnded: boolean;
  index: number;
  isSelected: boolean;
  unit: UnitModel;
  renderStat: Record<Stat, (unit: UnitModel) => ReactNode>;
  setSelectedUnitId: Dispatch<SetStateAction<string | null>>;
  stats: Stat[];
  user: UserModel | null | undefined;
}) {
  return (
    <SortableUnitTableRow
      canSort={canSort}
      hasEnded={hasEnded}
      index={index}
      isSelected={isSelected}
      onSelect={() => {
        if (!window.getSelection()?.isCollapsed) return;
        setSelectedUnitId(unit.id);
      }}
      unit={unit}
      renderStat={renderStat}
      stats={stats}
      user={user}
    />
  );
});

export default memo(TournamentTable);
