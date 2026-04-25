'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import {
  STATS_WITH_TIEBREAK,
  type STAT,
} from '@/app/tournaments/[id]/dashboard/tabs/table/column-types';
import PlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/player-drawer';
import {
  PlayerTableRow,
  SortableTableRow,
  TableLoading,
  TableStatsHeads,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-ui';
import { useSortablePlayerTable } from '@/app/tournaments/[id]/dashboard/tabs/table/use-sortable-player-table';
import { useTournamentRemovePlayer } from '@/components/hooks/mutation-hooks/use-tournament-remove-player';
import { useTournamentWithdrawPlayer } from '@/components/hooks/mutation-hooks/use-tournament-withdraw-player';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentScoringInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  sortPlayersByResultsWithMaps,
  type SortedPlayersResult,
} from '@/lib/tournament-results';
import { PlayerTournamentModel } from '@/server/zod/players';
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
  const players = useTournamentPlayers(id);
  const tournament = useTournamentScoringInfo(id);
  const { status, userId } = useContext(DashboardContext);
  const removePlayers = useTournamentRemovePlayer(id);
  const withdrawPlayer = useTournamentWithdrawPlayer(id);
  const t = useTranslations('Tournament.Table');
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerTournamentModel | null>(null);
  const hasStarted = !!tournament.data?.startedAt;
  const hasEnded = !!tournament.data?.closedAt;
  const { data: user } = useAuth();
  const type = tournament.data?.type;
  const allGames = useTournamentGames(id);
  const stats = STATS_WITH_TIEBREAK;
  const canSort = status === 'organizer' && !hasStarted;

  const {
    players: sortedPlayers,
    playerScoresMap,
    tiebreakScoresMap,
  } = useMemo<SortedPlayersResult>(() => {
    if (!players.data || !tournament.data) {
      return {
        players: [],
        playerScoresMap: new Map(),
        tiebreakScoresMap: new Map(),
      };
    }

    const tournamentForScoring = {
      format: tournament.data.format,
      ongoingRound: hasStarted ? tournament.data.ongoingRound : 0,
    };

    return sortPlayersByResultsWithMaps(
      players.data,
      tournamentForScoring,
      allGames.data ?? [],
    );
  }, [allGames.data, hasStarted, players.data, tournament.data]);

  const statRenderers = useMemo<
    Record<STAT, (player: PlayerTournamentModel) => ReactNode>
  >(
    () => ({
      wins: (player) => player.wins,
      draws: (player) => player.draws,
      losses: (player) => player.losses,
      score: (player) => playerScoresMap.get(player.id),
      tiebreak: (player) => (
        <span className="text-muted-foreground">
          {tiebreakScoresMap.get(player.id)}
        </span>
      ),
    }),
    [playerScoresMap, tiebreakScoresMap],
  );

  const { activePlayer, activePlayerId, handleDragStart, handleDragEnd } =
    useSortablePlayerTable(sortedPlayers, canSort);

  if (players.isLoading || allGames.isLoading) {
    return <TableLoading canSort={canSort} stats={stats} />;
  }

  if (players.isError) {
    toast.error(t('added players error'), {
      id: 'query-added-players',
      duration: 3000,
    });
    return <TableLoading canSort={canSort} stats={stats} />;
  }

  const handleDelete = () => {
    if (userId && status === 'organizer' && !hasStarted && selectedPlayer) {
      removePlayers.mutate(
        {
          tournamentId: id,
          playerId: selectedPlayer.id,
          userId,
        },
        { onSuccess: () => setSelectedPlayer(null) },
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
      selectedPlayer &&
      !selectedPlayer.isOut
    ) {
      withdrawPlayer.mutate(
        {
          tournamentId: id,
          playerId: selectedPlayer.id,
          userId,
        },
        { onSuccess: () => setSelectedPlayer(null) },
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
                  count: players.data?.length ?? 0,
                  small: (chunks) =>
                    !!players.data?.length && <small>{chunks}</small>,
                })}
              </TableHead>
              <TableStatsHeads stats={stats} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPlayers.map((player, index) => (
              <SortablePlayerRow
                key={player.id}
                canSort={canSort}
                hasEnded={hasEnded}
                index={index}
                isSelected={selectedPlayer?.id === player.id}
                player={player}
                renderStat={statRenderers}
                setSelectedPlayer={setSelectedPlayer}
                stats={stats}
                user={user}
              />
            ))}
          </TableBody>
        </Table>
        <DragOverlay dropAnimation={null}>
          {activePlayer ? (
            <Table className="bg-background">
              <TableBody>
                <PlayerTableRow
                  canSort={canSort}
                  hasEnded={hasEnded}
                  index={
                    activePlayerId
                      ? sortedPlayers.findIndex(
                          (player) => player.id === activePlayerId,
                        )
                      : 0
                  }
                  player={activePlayer}
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
      {selectedPlayer && (
        <PlayerDrawer
          key={selectedPlayer.id}
          player={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
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

const SortablePlayerRow = memo(function SortablePlayerRow({
  canSort,
  hasEnded,
  index,
  isSelected,
  player,
  renderStat,
  setSelectedPlayer,
  stats,
  user,
}: {
  canSort: boolean;
  hasEnded: boolean;
  index: number;
  isSelected: boolean;
  player: PlayerTournamentModel;
  renderStat: Record<STAT, (player: PlayerTournamentModel) => ReactNode>;
  setSelectedPlayer: Dispatch<SetStateAction<PlayerTournamentModel | null>>;
  stats: STAT[];
  user: UserModel | null | undefined;
}) {
  return (
    <SortableTableRow
      canSort={canSort}
      hasEnded={hasEnded}
      index={index}
      isSelected={isSelected}
      onSelect={() => setSelectedPlayer(player)}
      player={player}
      renderStat={renderStat}
      stats={stats}
      user={user}
    />
  );
});

export default memo(TournamentTable);
