'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import {
  Medal,
  medalColour,
} from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import PlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/player-drawer';
import { useTournamentRemovePlayer } from '@/components/hooks/mutation-hooks/use-tournament-remove-player';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlayerTournamentModel } from '@/server/db/zod/players';
import { useQueryClient } from '@tanstack/react-query';
import { Scale, Trophy, UserRoundX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, PropsWithChildren, useContext, useState } from 'react';
import { toast } from 'sonner';

import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';

const TournamentTable: FC = ({}) => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const players = useTournamentPlayers(id);
  const tournament = useTournamentInfo(id);
  const { status, sendJsonMessage } = useContext(DashboardContext);
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

  const roundNumber = hasStarted
    ? (tournament.data?.tournament.ongoingRound ?? 1)
    : 0;
  const roundGames = useTournamentRoundGames({
    tournamentId: id,
    roundNumber,
  });

  const getScore = (player: PlayerTournamentModel) => {
    const sumOfResults =
      (player.wins ?? 0) + (player.draws ?? 0) + (player.losses ?? 0);
    const hasUnfinishedGame =
      roundGames.data?.some(
        (g) =>
          (g.whiteId === player.id || g.blackId === player.id) &&
          g.result === null,
      ) ?? false;
    const actualResultsTotal = sumOfResults + (hasUnfinishedGame ? 1 : 0);
    const byes = Math.max(0, roundNumber - actualResultsTotal);
    return (player.wins ?? 0) + byes + (player.draws ?? 0) * 0.5;
  };

  const stats = STATS;

  if (players.isLoading || (hasStarted && roundGames.isLoading)) {
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
      <Table className="pt-0">
        <TableHeader className="bg-background/50 sticky top-0 backdrop-blur-md">
          <TableRow>
            <TableHeadStyled className="text-center">#</TableHeadStyled>
            <TableHeadStyled className="w-full p-0">
              {t.rich('name column', {
                count: players.data?.length ?? 0,
                small: (chunks) =>
                  !!players.data?.length && <small>{chunks}</small>,
              })}
            </TableHeadStyled>
            <TableStatsHeads stats={stats} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.data?.map((player, i) => (
            <TableRow key={player.id} onClick={() => setSelectedPlayer(player)}>
              <TableCellStyled className={`font-small w-10 text-center`}>
                <Place player={player} hasEnded={hasEnded}>
                  {i + 1}
                </Place>
              </TableCellStyled>
              <TableCellStyled className="font-small flex gap-2 truncate pl-0">
                <Status player={{ ...player, isOut: false }}>
                  {player.nickname}
                </Status>
              </TableCellStyled>
              {stats.map((stat) => (
                <Stat key={stat}>
                  {stat === 'wins' && player.wins}
                  {stat === 'draws' && player.draws}
                  {stat === 'losses' && player.losses}
                  {stat === 'score' && getScore(player)}
                  {stat === 'tiebreak' && mockBergerScore(player)}
                </Stat>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {selectedPlayer && (
        <PlayerDrawer
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

const TableStatsHeads: FC<{ stats: string[] }> = ({ stats }) => {
  const { isMobile } = useContext(MediaQueryContext);
  const t = useTranslations(
    `Tournament.Table.Stats.${isMobile ? 'short' : 'full'}`,
  );

  return (
    <>
      {stats.map((stat) => (
        <TableHeadStyled key={stat} className="text-center">
          {stat === 'tiebreak' ? (
            <Scale className="m-auto size-3.5" />
          ) : stat === 'score' ? (
            <Trophy className="m-auto size-3.5" />
          ) : (
            t(stat)
          )}
        </TableHeadStyled>
      ))}
    </>
  );
};

const TableLoading: FC<{ stats: string[] }> = ({ stats }) => {
  const t = useTranslations('Tournament.Table');
  return (
    <div className="h-full w-full items-center justify-center">
      <span className="sr-only">{t('loading')}</span>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeadStyled className="p-mk text-center">#</TableHeadStyled>
            <TableHeadStyled className="p-0">
              {t.rich('name column', {
                count: 0,
                small: (chunks) => <small>{chunks}</small>,
              })}
            </TableHeadStyled>
            <TableStatsHeads stats={stats} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(20)
            .fill(0)
            .map((_, i) => (
              <TableRow key={i}>
                <TableCellStyled className="h-11">
                  <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                </TableCellStyled>
                <TableCellStyled>
                  <div className="bg-muted h-4 w-40 animate-pulse rounded" />
                </TableCellStyled>
                {Array(stats.length)
                  .fill(0)
                  .map((_, j) => (
                    <TableCellStyled key={j}>
                      <div className="bg-muted mx-auto h-4 w-8 animate-pulse rounded" />
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

const Status: FC<{ player: PlayerTournamentModel } & PropsWithChildren> = ({
  player,
  children,
}) => {
  if (!player.isOut) return children;
  return (
    <div className="flex items-center gap-2 opacity-50">
      <UserRoundX className="size-4 min-w-fit" />
      {children}
    </div>
  );
};

const TableCellStyled: FC<PropsWithChildren & { className?: string }> = ({
  children,
  className,
}) => (
  <TableCell className={`p-3 text-wrap ${className}`}>{children}</TableCell>
);

const TableHeadStyled: FC<PropsWithChildren & { className?: string }> = ({
  children,
  className,
}) => <TableHead className={`h-11 ${className}`}>{children}</TableHead>;

const Stat: FC<PropsWithChildren> = ({ children }) => (
  <TableCellStyled className="min-w-8 text-center font-medium">
    {children}
  </TableCellStyled>
);

/**
 * Mock Berger tiebreak calculation.
 * Berger is typically sum of defeated opponents' scores + half of drawn opponents' scores.
 * Here, we just mock it as: wins * 3 + draws * 1 + losses * 0.5
 */
function mockBergerScore(player: PlayerTournamentModel): number {
  return (
    (player.wins ?? 0) * 3 +
    (player.draws ?? 0) * 1 +
    (player.losses ?? 0) * 0.5
  );
}

const STATS = ['wins', 'draws', 'losses', 'score'];
const STATS_WITH_TIEBREAK = [...STATS, 'tiebreak'];

export default TournamentTable;
