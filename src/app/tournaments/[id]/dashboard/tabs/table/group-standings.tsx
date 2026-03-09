import type { StandingsGroup } from '@/app/tournaments/[id]/dashboard/tabs/table/table-types';
import StandingsTable, {
  StandingsTableProps,
} from '@/app/tournaments/[id]/dashboard/tabs/table/standings-table';
import { sortPlayersByResultsWithMaps } from '@/lib/tournament-results';
import { TournamentModel } from '@/server/zod/tournaments';
import { FC } from 'react';

const GroupStandings: FC<
  {
    group: StandingsGroup;
    tournament: TournamentModel | null | undefined;
  } & Omit<
    StandingsTableProps,
    'players' | 'playerScoresMap' | 'tiebreakScoresMap'
  >
> = ({ group, tournament, ...props }) => {
  if (!tournament) return null;
  const groupResult = sortPlayersByResultsWithMaps(
    group.players,
    {
      format: tournament.format,
      ongoingRound: tournament.startedAt ? tournament.ongoingRound : 0,
    },
    group.games ?? [],
  );
  return (
    <StandingsTable
      {...props}
      players={groupResult.players}
      playerScoresMap={groupResult.playerScoresMap}
      tiebreakScoresMap={groupResult.tiebreakScoresMap}
    />
  );
};

export default GroupStandings;
