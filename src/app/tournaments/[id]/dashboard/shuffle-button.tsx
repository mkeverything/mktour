import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import Fab from '@/components/fab';
import { useTournamentReorderPlayers } from '@/components/hooks/mutation-hooks/use-tournament-reorder-players';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { Button } from '@/components/ui/button';
import { buildShuffledPreStartRoundState } from '@/lib/pre-start-round';
import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel, TournamentInfoModel } from '@/server/zod/tournaments';
import { Loader2, Shuffle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useContext } from 'react';

const ShuffleButton = () => {
  const { isPending, handleClick, tournament, players, games } = useShuffle();
  const { userId, status } = useContext(DashboardContext);
  const { isDesktop } = useContext(MediaQueryContext);

  if (
    tournament?.tournament.startedAt ||
    !games ||
    !players ||
    !userId ||
    status !== 'organizer'
  )
    return null;

  const isSufficient = players && players.length > 2;

  const desktop = isSufficient ? (
    <Button
      onClick={handleClick}
      disabled={isPending}
      size="icon-lg"
      variant="outline"
    >
      {!isPending ? <Shuffle /> : <LoadingSpinner />}
    </Button>
  ) : null;

  const mobile = (
    <Fab
      disabled={isPending || !isSufficient}
      icon={!isPending ? Shuffle : Loader2}
      onClick={handleClick}
    />
  );

  const component = isDesktop ? desktop : mobile;

  return component;
};

const useShuffle = (): ShuffleProps => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data: tournament } = useTournamentInfo(tournamentId);
  const { data: players } = useTournamentPlayers(tournamentId);
  const { data: games } = useTournamentRoundGames({
    tournamentId,
    roundNumber: 1,
  });
  const reorderPlayers = useTournamentReorderPlayers(tournamentId);

  const handleClick = () => {
    if (!players || !games) return null;

    const preStartState = buildShuffledPreStartRoundState({
      players,
      tournamentId,
    });
    reorderPlayers.mutate({
      tournamentId,
      playerIds: preStartState.players.map((player) => player.id),
    });
  };

  return {
    isPending: reorderPlayers.isPending,
    handleClick,
    tournament,
    players,
    games,
  };
};

type ShuffleProps = {
  isPending: boolean;
  handleClick: () => void;
  tournament: TournamentInfoModel | undefined;
  players: PlayerTournamentModel[] | undefined;
  games: GameModel[] | undefined;
};

export default ShuffleButton;
