'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import {
  Medal,
  medalColour,
} from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import PlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/player-drawer';
import { useTournamentRemovePlayer } from '@/components/hooks/mutation-hooks/use-tournament-remove-player';
import { useTournamentWithdrawPlayer } from '@/components/hooks/mutation-hooks/use-tournament-withdraw-player';
import { useTournamentScoringInfo } from '@/components/hooks/query-hooks/use-tournament-info';
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
import { Scale, Trophy, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  Dispatch,
  FC,
  memo,
  PropsWithChildren,
  ReactNode,
  SetStateAction,
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
  const players = useTournamentPlayers(id);
  const tournament = useTournamentScoringInfo(id);
  const { status } = useContext(DashboardContext);
  const removePlayers = useTournamentRemovePlayer(id);
  const withdrawPlayer = useTournamentWithdrawPlayer(id);
  const { userId } = useContext(DashboardContext);
  const t = useTranslations('Tournament.Table');
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerTournamentModel | null>(null);
  const hasStarted = !!tournament.data?.startedAt;
  const hasEnded = !!tournament.data?.closedAt;
  const { data: user } = useAuth();
  const type = tournament.data?.type;
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
      format: tournament.data.format,
      ongoingRound: hasStarted ? tournament.data.ongoingRound : 0,
    };

    return sortPlayersByResultsWithMaps(
      players.data,
      tournamentForScoring,
      allGames.data ?? [],
    );
  }, [players.data, tournament.data, allGames.data, hasStarted]);

  const stats: Stat[] = STATS_WITH_TIEBREAK;
  const statRenderers = useMemo<
    Record<Stat, (player: PlayerTournamentModel) => ReactNode>
  >(
    () => ({
      wins: (p) => p.wins,
      draws: (p) => p.draws,
      losses: (p) => p.losses,
      score: (p) => playerScoresMap.get(p.id),
      tiebreak: (p) => (
        <span className="text-muted-foreground">
          {tiebreakScoresMap.get(p.id)}
        </span>
      ),
    }),
    [playerScoresMap, tiebreakScoresMap],
  );

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
      <Table className="pt-0">
        <TableHeader className="bg-background/50 sticky top-0 backdrop-blur-md">
          <TableRow>
            <TableHeadStyled className="text-center">#</TableHeadStyled>
            <TableHeadStyled className="w-full min-w-10 p-0">
              {t.rich(nameColumnIntl, {
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
            <PlayerRow
              key={player.id}
              hasEnded={hasEnded}
              index={i}
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

const PlayerRow = memo(function PlayerRow({
  hasEnded,
  index,
  isSelected,
  player,
  renderStat,
  setSelectedPlayer,
  stats,
  user,
}: {
  hasEnded: boolean;
  index: number;
  isSelected: boolean;
  player: PlayerTournamentModel;
  renderStat: Record<Stat, (player: PlayerTournamentModel) => ReactNode>;
  setSelectedPlayer: Dispatch<SetStateAction<PlayerTournamentModel | null>>;
  stats: Stat[];
  user: UserModel | null | undefined;
}) {
  return (
    <TableRow
      onClick={() => setSelectedPlayer(player)}
      className={[
        player.username === user?.username ? 'bg-card/50 font-bold' : '',
        isSelected ? 'bg-card/70' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TableCellStyled className="font-small w-10 text-center">
        <Place player={player} hasEnded={hasEnded}>
          {index + 1}
        </Place>
      </TableCellStyled>
      <TableCellStyled className="font-small max-w-0 truncate pl-0">
        <Status player={player} user={user}>
          {player.nickname}
        </Status>
      </TableCellStyled>
      {stats.map((stat) => (
        <Stat key={stat}>{renderStat[stat](player)}</Stat>
      ))}
    </TableRow>
  );
});

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
                <TableCellStyled className="font-small max-w-0 truncate pl-0">
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
  const pairPlayers = player.pairPlayers ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div
        className={`gap-mk flex min-w-0 items-center ${player.isOut && 'text-muted-foreground line-through'}`}
      >
        <span className="truncate">{children}</span>
        {player.username && (
          <UserRound className="text-muted-foreground size-4 shrink-0" />
        )}
      </div>
      {pairPlayers.length === 2 && (
        <small className="text-muted-foreground text-2xs truncate">
          {pairPlayers[0].nickname}, {pairPlayers[1].nickname}
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
  tiebreak: <Scale className="m-auto size-4" />,
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

export default memo(TournamentTable);
