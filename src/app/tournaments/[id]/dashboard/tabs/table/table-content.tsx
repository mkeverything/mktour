'use client';

import GroupStandings from '@/app/tournaments/[id]/dashboard/tabs/table/group-standings';
import StandingsTable from '@/app/tournaments/[id]/dashboard/tabs/table/standings-table';
import type { Stat } from '@/app/tournaments/[id]/dashboard/tabs/table/table-parts';
import { type SortedPlayersResult } from '@/lib/tournament-results';
import { PlayerTournamentModel } from '@/server/zod/players';
import { TournamentModel } from '@/server/zod/tournaments';
import { FC } from 'react';

import type { StandingsGroup } from '@/app/tournaments/[id]/dashboard/tabs/table/table-types';

export interface TableContentProps {
  standingsGroups: StandingsGroup[] | null;
  singleBlockResult: SortedPlayersResult | null;
  stats: Stat[];
  hasEnded: boolean;
  tournamentType: 'solo' | 'doubles' | 'team';
  currentUsername: string | null;
  onRowClick: (player: PlayerTournamentModel) => void;
  playerCount: number;
  tournament: TournamentModel | null | undefined;
}

const TableContent: FC<TableContentProps> = ({
  standingsGroups,
  singleBlockResult,
  stats,
  hasEnded,
  tournamentType,
  currentUsername,
  onRowClick,
  playerCount,
  tournament,
}) => {
  const groupsToShow = standingsGroups ?? [];
  const isGrouped = groupsToShow.length > 0;

  if (isGrouped) {
    return (
      <div className="flex flex-col gap-8">
        {groupsToShow.map((group) => (
          <GroupStandings
            key={group.id}
            group={group}
            tournament={tournament}
            stats={stats}
            hasEnded={hasEnded}
            tournamentType={tournamentType}
            currentUsername={currentUsername}
            onRowClick={onRowClick}
            playerCount={playerCount}
          />
        ))}
      </div>
    );
  }

  if (singleBlockResult) {
    return (
      <StandingsTable
        players={singleBlockResult.players}
        playerScoresMap={singleBlockResult.playerScoresMap}
        tiebreakScoresMap={singleBlockResult.tiebreakScoresMap}
        stats={stats}
        hasEnded={hasEnded}
        tournamentType={tournamentType}
        currentUsername={currentUsername}
        onRowClick={onRowClick}
        playerCount={playerCount}
      />
    );
  }

  return null;
};

export default TableContent;
