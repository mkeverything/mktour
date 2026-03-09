'use client';

import {
  Place,
  Stat,
  Status,
  TableCellStyled,
  TableHeadStyled,
  TableStatsHeads,
  type Stat as StatType,
} from '@/app/tournaments/[id]/dashboard/tabs/table/table-parts';
import { Table, TableBody, TableHeader, TableRow } from '@/components/ui/table';
import { PlayerTournamentModel } from '@/server/zod/players';
import { useTranslations } from 'next-intl';
import { FC, ReactNode } from 'react';

export interface StandingsTableProps {
  players: PlayerTournamentModel[];
  playerScoresMap: Map<string, number>;
  tiebreakScoresMap: Map<string, number>;
  stats: StatType[];
  hasEnded: boolean;
  tournamentType: 'solo' | 'doubles' | 'team';
  currentUsername: string | null | undefined;
  onRowClick: (player: PlayerTournamentModel) => void;
  title?: string;
  playerCount: number;
}

const StandingsTable: FC<StandingsTableProps> = ({
  players,
  playerScoresMap,
  tiebreakScoresMap,
  stats,
  hasEnded,
  tournamentType,
  currentUsername,
  onRowClick,
  title,
  playerCount,
}) => {
  const t = useTranslations('Tournament.Table');
  const nameColumnIntl =
    tournamentType !== 'solo' ? 'name column team' : 'name column';

  const statRenderers: Record<
    StatType,
    (player: PlayerTournamentModel) => ReactNode
  > = {
    wins: (p) => p.wins,
    draws: (p) => p.draws,
    losses: (p) => p.losses,
    score: (p) => playerScoresMap.get(p.id),
    tiebreak: (p) => (
      <span className="text-muted-foreground">
        {tiebreakScoresMap.get(p.id)}
      </span>
    ),
  };

  return (
    <section className="w-full">
      {title && (
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {title}
        </h3>
      )}
      <Table className="pt-0">
        <TableHeader className="bg-background/50 sticky top-0 backdrop-blur-md">
          <TableRow>
            <TableHeadStyled className="text-center">#</TableHeadStyled>
            <TableHeadStyled className="w-full min-w-10 p-0">
              {t.rich(nameColumnIntl, {
                count: playerCount,
                small: (chunks) => playerCount > 0 && <small>{chunks}</small>,
              })}
            </TableHeadStyled>
            <TableStatsHeads stats={stats} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player, i) => (
            <TableRow
              key={player.id}
              onClick={() => onRowClick(player)}
              className={`${player.username === currentUsername && 'bg-card/50 font-bold'}`}
            >
              <TableCellStyled className="font-small w-10 text-center">
                <Place player={player} hasEnded={hasEnded}>
                  {i + 1}
                </Place>
              </TableCellStyled>
              <TableCellStyled className="font-small max-w-0 truncate pl-0">
                <Status player={player} user={undefined}>
                  {player.nickname}
                </Status>
              </TableCellStyled>
              {stats.map((stat) => (
                <Stat key={stat}>{statRenderers[stat](player)}</Stat>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
};

export default StandingsTable;
