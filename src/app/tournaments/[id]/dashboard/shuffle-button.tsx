import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import Fab from '@/components/fab';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { Button } from '@/components/ui/button';
import { generateRandomRoundGames } from '@/lib/pairing-generators/random-pairs-generator';
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
      {!isPending ? <Shuffle /> : <Loader2 />}
    </Button>
  ) : null;

  const mobile = isSufficient ? (
    <Fab
      disabled={isPending}
      icon={!isPending ? Shuffle : Loader2}
      onClick={handleClick}
    />
  ) : (
    <AddPlayerDrawer />
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
  const { isPending, mutate } = useSaveRound({
    isTournamentGoing: false,
  });

  const handleClick = () => {
    if (!players || !games) return null;

    const newGames = generateRandomRoundGames({
      players: players.map((player, i) => ({
        ...player,
        pairingNumber: i,
      })),
      games,
      roundNumber: 1,
      tournamentId,
    });
    mutate({ tournamentId, newGames, roundNumber: 1 });
  };

  return { isPending, handleClick, tournament, players, games };
};

type ShuffleProps = {
  isPending: boolean;
  handleClick: () => void;
  tournament: TournamentInfoModel | undefined;
  players: PlayerTournamentModel[] | undefined;
  games: GameModel[] | undefined;
};

export default ShuffleButton;
