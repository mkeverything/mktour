'use client';
import { LoadingSpinner } from '@/app/loading';
import {
  DashboardContext,
  DashboardRoundContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import { GamesGridLoadingSkeleton } from '@/app/tournaments/[id]/dashboard/loading-skeletons';
import { GamesColorIndication } from '@/app/tournaments/[id]/dashboard/tabs/games/games-color-indication';
import { getGamesGridClassName } from '@/app/tournaments/[id]/dashboard/tabs/games/games-grid';
import GameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/game-item';
import Center from '@/components/center';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentGames } from '@/components/hooks/query-hooks/use-tournament-games';
import { useTournamentRoundProgressInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { useRoundData } from '@/components/hooks/use-round-data';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import { AppError } from '@/lib/errors';
import { RoundProps } from '@/lib/pairing-generators/common-generator';
import { generateRoundRobinRound } from '@/lib/pairing-generators/round-robin-generator';
import { generateWeightedSwissRound } from '@/lib/pairing-generators/swiss-generator';
import { TournamentFormat } from '@/server/zod/enums';
import { GameModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Dispatch, FC, memo, SetStateAction, useContext } from 'react';

const RoundItem: FC<RoundItemProps> = ({
  roundNumber,
  onOpenStartTournamentDrawer,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const {
    data: round,
    isError,
    isLoading,
  } = useTournamentRoundGames({
    tournamentId,
    roundNumber,
  });
  const info = useTournamentRoundProgressInfo(tournamentId);
  const { data: units } = useTournamentUnits(tournamentId);
  const { status } = useContext(DashboardContext);
  const { selectedGameId, setSelectedGameId } = useContext(SelectedGameContext);
  const { sortedRound } = useRoundData(round, units);
  const gamesGridClassName = getGamesGridClassName(units);

  if (isLoading || !info.data || !units)
    return <GamesGridLoadingSkeleton units={units} />;

  if (isError) return <Center>error</Center>;
  if (!round) return <Center>no round</Center>;

  const isOngoing = !!info.data.startedAt && !info.data.closedAt;

  return (
    <div className="@container w-full">
      <GamesColorIndication units={units} />
      <div className={`${gamesGridClassName} pt-mk`}>
        {status === 'organizer' && isOngoing ? (
          <div className="col-span-full">
            <ActionButton roundNumber={roundNumber} />
          </div>
        ) : null}
        {sortedRound.map((game) => {
          return (
            <GamesIteratee
              key={game.id}
              selected={selectedGameId === game.id}
              setSelectedGameId={setSelectedGameId}
              onOpenStartTournamentDrawer={onOpenStartTournamentDrawer}
              {...game}
            />
          );
        })}
      </div>
    </div>
  );
};

const ActionButton: FC<{ roundNumber: number }> = ({ roundNumber }) => {
  return (
    <>
      <NewRoundButton roundNumber={roundNumber} />
      <div className="md:hidden">
        <FinishTournamentButton />
      </div>
    </>
  );
};

function generateRound(
  format: TournamentFormat,
  props: RoundProps,
): GameModel[] {
  switch (format) {
    case 'swiss':
      return generateWeightedSwissRound(props);
    case 'round robin':
      return generateRoundRobinRound(props);
    default:
      throw new AppError('UNSUPPORTED_TOURNAMENT_FORMAT', {
        cause: `unsupported format: ${format}`,
      });
  }
}

const NewRoundButton: FC<{ roundNumber: number }> = ({ roundNumber }) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const t = useTranslations('Tournament.Round');
  const { data: info } = useTournamentRoundProgressInfo(tournamentId);
  const { data: roundGames } = useTournamentRoundGames({
    tournamentId,
    roundNumber,
  });
  const { data: tournamentGames } = useTournamentGames(tournamentId);
  const queryClient = useQueryClient();
  const { setRoundInView } = useContext(DashboardRoundContext);

  const { mutate, isPending: mutating } = useSaveRound(tournamentId, {
    isTournamentGoing: true,
    setRoundInView,
  });
  const trpc = useTRPC();

  if (
    !info ||
    !roundGames ||
    roundNumber !== info.ongoingRound ||
    info.ongoingRound === info.roundsNumber ||
    roundGames.some((game) => game.result === null) ||
    roundGames.length === 0
  ) {
    return null;
  }

  const newRound = () => {
    const units = queryClient.getQueryData(
      trpc.tournament.units.queryKey({ tournamentId }),
    );
    const games = tournamentGames;
    if (!units || !games) return;
    const newGames = generateRound(info.format, {
      players: units,
      games,
      roundNumber: roundNumber + 1,
      tournamentId,
    });
    mutate({ tournamentId, roundNumber: roundNumber + 1, newGames });
  };

  return (
    <Button className="w-full" onClick={newRound} disabled={mutating}>
      {!mutating ? <ArrowRightIcon /> : <LoadingSpinner />}
      {t('new round button')}
    </Button>
  );
};

const GamesIteratee = memo(function GamesIteratee(
  props: GameModel & {
    selected: boolean;
    setSelectedGameId: Dispatch<SetStateAction<string | null>>;
    onOpenStartTournamentDrawer: () => void;
  },
) {
  return <GameItem {...props} />;
});

type RoundItemProps = {
  roundNumber: number;
  onOpenStartTournamentDrawer: () => void;
  compact?: boolean;
};

export default RoundItem;
