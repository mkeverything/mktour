import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import Fab from '@/components/fab';
import { useTournamentReorderUnits } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-reorder-units';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { Button } from '@/components/ui/button';
import { shuffle } from '@/lib/utils';
import {
  GameModel,
  TournamentInfoModel,
  UnitModel,
} from '@/server/zod/tournaments';
import { Loader2, Shuffle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useContext } from 'react';

const ShuffleButton = () => {
  const { isPending, handleClick, tournament, units, games } = useShuffle();
  const { userId, status } = useContext(DashboardContext);
  const { isDesktop } = useContext(MediaQueryContext);

  if (
    tournament?.tournament.startedAt ||
    !games ||
    !units ||
    !userId ||
    status !== 'organizer'
  )
    return null;

  const isSufficient = units.length > 2;

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
  const { data: units } = useTournamentUnits(tournamentId);
  const { data: games } = useTournamentRoundGames({
    tournamentId,
    roundNumber: 1,
  });
  const reorderUnits = useTournamentReorderUnits(tournamentId);

  const handleClick = () => {
    if (!units || !games) return null;

    reorderUnits.mutate({
      tournamentId,
      unitIds: shuffle(units).map((unit) => unit.id),
    });
  };

  return {
    isPending: reorderUnits.isPending,
    handleClick,
    tournament,
    units,
    games,
  };
};

type ShuffleProps = {
  isPending: boolean;
  handleClick: () => void;
  tournament: TournamentInfoModel | undefined;
  units: UnitModel[] | undefined;
  games: GameModel[] | undefined;
};

export default ShuffleButton;
