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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlayerTournamentModel } from '@/server/zod/players';
import { useQueryClient } from '@tanstack/react-query';
import { Flag, Scale, Trophy, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  FC,
  PropsWithChildren,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';

import FormattedMessage from '@/components/formatted-message';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import {
  type SortedPlayersResult,
  sortPlayersByResultsWithMaps,
} from '@/lib/tournament-results';
import { UserModel } from '@/server/zod/users';

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
  const { data: user } = useAuth();

  const allGames = useTournamentGames(id);

  const {
    players: sortedPlayers,
    playerScoresMap,
    tiebreakScoresMap,
  } = useMemo<SortedPlayersResult>(() => {
    if (!players.data || !tournament.data)
      return {
        players: [],
        playerScoresMap: new Map(),
        tiebreakScoresMap: new Map(),
      };

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

  const statRenderers: Record<
    Stat,
    (player: PlayerTournamentModel) => ReactNode
  > = {
    wins: (p) => p.wins,
    draws: (p) => p.draws,
    losses: (p) => p.losses,
    score: (p) => playerScoresMap.get(p.id),
    tiebreak: (p) => tiebreakScoresMap.get(p.id),
  };

  return (
    <div className="mb-20 w-full">
      <Table className="pt-0">
        <TableHeader className="bg-background/50 sticky top-0 backdrop-blur-md">
          <TableRow>
            <TableHeadStyled className="text-center">#</TableHeadStyled>
            <TableHeadStyled className="w-full min-w-10 p-0">
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
          {sortedPlayers.map((player: PlayerTournamentModel, i: number) => (
            <TableRow
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className={`${player.username === user?.username && 'bg-card/50 font-bold'}`}
            >
              <TableCellStyled className={`font-small w-10 text-center`}>
                <Place player={player} hasEnded={hasEnded}>
                  {i + 1}
                </Place>
              </TableCellStyled>
              <TableCellStyled className="font-small flex gap-2 truncate pl-0">
                <Status player={player} user={user}>
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

const TableStatsHeads: FC<{ stats: Stat[] }> = ({ stats }) => {
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

const TableLoading: FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div className="h-full w-full items-center justify-center overflow-hidden">
      <span className="sr-only">
        <FormattedMessage id="Tournament.Table.loading" />
      </span>
      <Table>
        <TableHeader>
          <TableRow>
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
                <TableCellStyled className="font-small w-10 text-center">
                  <div className="bg-muted mx-auto h-4 w-4 animate-pulse rounded" />
                </TableCellStyled>
                <TableCellStyled className="font-small flex gap-2 truncate pl-0">
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
  return (
    <div
      className={`gap-mk flex items-center ${player.isOut && 'text-muted-foreground'}`}
    >
      {children}
      {player.username && (
        <UserRound className="text-muted-foreground size-4" />
      )}
      {player.isOut && <Flag className="size-4" />}
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

const renderTextHead = (stat: Exclude<Stat, 'score' | 'tiebreak'>) => (
  <>
    <div className="block sm:hidden md:block xl:hidden">
      <FormattedMessage id={`Tournament.Table.Stats.short.${stat}`} />
    </div>
    <div className="hidden sm:block md:hidden xl:block">
      <FormattedMessage id={`Tournament.Table.Stats.full.${stat}`} />
    </div>
  </>
);

const statHeadRenderers: Record<Stat, React.ReactNode> = {
  wins: renderTextHead('wins'),
  draws: renderTextHead('draws'),
  losses: renderTextHead('losses'),
  score: <Trophy className="m-auto size-3.5" />,
  tiebreak: <Scale className="m-auto size-3.5" />,
};

const STATS_WITH_TIEBREAK: Stat[] = [
  'wins',
  'draws',
  'losses',
  'score',
  'tiebreak',
];

type Stat =
  | keyof Pick<PlayerTournamentModel, 'wins' | 'draws' | 'losses'>
  | 'score'
  | 'tiebreak';

export default TournamentTable;
