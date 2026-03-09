'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import PlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/player-drawer';
import TableContent from '@/app/tournaments/[id]/dashboard/tabs/table/table-content';
import TableLoading from '@/app/tournaments/[id]/dashboard/tabs/table/table-loading';
import {
  STATS_WITH_TIEBREAK,
  type Stat,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-parts';
import { generateMockGroups } from '@/app/tournaments/[id]/dashboard/tabs/standings-groups';
import { useTournamentRemovePlayer } from '@/components/hooks/mutation-hooks/use-tournament-remove-player';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import {
  type SortedPlayersResult,
  sortPlayersByResultsWithMaps,
} from '@/lib/tournament-results';
import { PlayerTournamentModel } from '@/server/zod/players';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';

const TournamentTable: FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const players = useTournamentPlayers(id);
  const tournament = useTournamentInfo(id);
  const { status, sendJsonMessage, mockMode } = useContext(DashboardContext);
  const removePlayers = useTournamentRemovePlayer(
    id,
    queryClient,
    sendJsonMessage,
  );
  const { userId } = useContext(DashboardContext);
  const t = useTranslations('Tournament.Table');
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerTournamentModel | null>(null);
  const hasStarted = !!tournament.data?.tournament.startedAt;
  const hasEnded = !!tournament.data?.tournament.closedAt;
  const { data: user } = useAuth();
  const type = tournament.data?.tournament.type ?? 'solo';
  const allGames = useTournamentGames(id);

  const singleBlockResult = useMemo<SortedPlayersResult | null>(() => {
    if (!players.data || !tournament.data) return null;
    const tournamentForScoring = {
      format: tournament.data.tournament.format,
      ongoingRound: hasStarted ? tournament.data.tournament.ongoingRound : 0,
    };
    return sortPlayersByResultsWithMaps(
      players.data,
      tournamentForScoring,
      allGames.data ?? [],
    );
  }, [players.data, tournament.data, allGames.data, hasStarted]);

  const standingsGroups = useMemo(
    () =>
      mockMode === 'group_stage' ? generateMockGroups(players.data ?? []) : [],
    [players.data, mockMode],
  );

  const isElimination =
    mockMode === 'single_elim' || mockMode === 'double_elim';
  if (isElimination) return null;

  const stats: Stat[] = STATS_WITH_TIEBREAK;

  if (players.isLoading || allGames.isLoading) {
    return <TableLoading stats={stats} />;
  }
  if (players.isError) {
    toast.error(t('added players error'), {
      id: 'query-added-players',
      duration: 3000,
    });
    return <TableLoading stats={stats} />;
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

  return (
    <div className="mb-20 w-full">
      <TableContent
        standingsGroups={standingsGroups}
        singleBlockResult={singleBlockResult}
        stats={stats}
        hasEnded={hasEnded}
        tournamentType={type}
        currentUsername={user?.username ?? null}
        onRowClick={setSelectedPlayer}
        playerCount={players.data?.length ?? 0}
        tournament={tournament.data?.tournament}
      />
      {selectedPlayer && (
        <PlayerDrawer
          key={selectedPlayer.id}
          player={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          handleDelete={handleDelete}
          hasStarted={hasStarted}
          hasEnded={hasEnded}
        />
      )}
    </div>
  );
};

export type { StandingsGroup } from '@/app/tournaments/[id]/dashboard/tabs/table/table-types';
export {
  Place,
  STATS_WITH_TIEBREAK,
  Stat,
  Status,
  TableCellStyled,
  TableHeadStyled,
  TableStatsHeads,
  statHeadRenderers,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-parts';

export default TournamentTable;
