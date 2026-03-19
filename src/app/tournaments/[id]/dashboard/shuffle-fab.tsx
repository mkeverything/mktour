import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddPlayerDrawer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import Fab from '@/components/fab';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { generateRandomRoundGames } from '@/lib/pairing-generators/random-pairs-generator';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Shuffle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useContext } from 'react';

const ShuffleFab = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data } = useTournamentInfo(tournamentId);
  const players = useTournamentPlayers(tournamentId);
  const games = useTournamentRoundGames({ tournamentId, roundNumber: 1 });
  const { userId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const { status } = useContext(DashboardContext);
  const { isPending, mutate } = useSaveRound({
    queryClient,
    isTournamentGoing: false,
  });
  const { isDesktop } = useContext(MediaQueryContext);

  if (
    data?.tournament.startedAt ||
    !games.data ||
    !players.data ||
    !userId ||
    status !== 'organizer'
  )
    return null;

  if (players.data && players.data.length < 3)
    return isDesktop ? null : <AddPlayerDrawer />;

  const handleClick = () => {
    const newGames = generateRandomRoundGames({
      players: players.data.map((player, i) => ({
        ...player,
        pairingNumber: i,
      })),
      games: games.data,
      roundNumber: 1,
      tournamentId,
    });
    mutate({ tournamentId, newGames, roundNumber: 1 });
  };

  return (
    <Fab
      disabled={isPending}
      icon={!isPending ? Shuffle : Loader2}
      onClick={handleClick}
    />
  );
};

export default ShuffleFab;
