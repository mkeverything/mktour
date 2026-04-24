'use client';
import { LoadingSpinner } from '@/app/loading';
import {
  DashboardContext,
  DashboardRoundContext,
  SelectedGameContext,
} from '@/app/tournaments/[id]/dashboard/dashboard-context';
import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import GameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/game-item';
import Center from '@/components/center';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentRoundProgressInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { useRoundData } from '@/components/hooks/use-round-data';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import { RoundProps } from '@/lib/pairing-generators/common-generator';
import { generateRoundRobinRound } from '@/lib/pairing-generators/round-robin-generator';
import { generateWeightedSwissRound } from '@/lib/pairing-generators/swiss-generator';
import { TournamentFormat } from '@/server/zod/enums';
import { GameModel } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Dispatch, FC, SetStateAction, useContext } from 'react';

const RoundItem: FC<RoundItemProps> = ({ roundNumber }) => {
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
  const { data: players } = useTournamentPlayers(tournamentId);
  const { status } = useContext(DashboardContext);
  const { selectedGameId, setSelectedGameId } = useContext(SelectedGameContext);
  const { sortedRound, ongoingGames } = useRoundData(round, players);

  if (isLoading || !info.data || !players)
    return (
      <div className="mx-auto px-4 pt-2 lg:max-w-xl lg:px-0">
        <SkeletonList length={8} className="h-12" />
      </div>
    );

  if (isError) return <Center>error</Center>;
  if (!round) return <Center>no round</Center>;

  const { ongoingRound, roundsNumber, closedAt, format } = info.data;
  const renderFinishButton =
    status === 'organizer' && !closedAt && ongoingRound === roundsNumber;
  const renderNewRoundButton =
    roundNumber === ongoingRound &&
    ongoingRound !== roundsNumber &&
    ongoingGames === 0 &&
    status === 'organizer' &&
    round.length > 0;

  return (
    <div className="mk-list px-mk md:px-mk-2 pt-2">
      <ActionButton
        renderNewRoundButton={renderNewRoundButton}
        roundNumber={roundNumber}
        roundsNumber={roundsNumber}
        tournamentId={tournamentId}
        renderFinishButton={renderFinishButton}
        format={format}
      />
      {sortedRound.map((game) => {
        return (
          <GamesIteratee
            key={game.id}
            selected={selectedGameId === game.id}
            setSelectedGameId={setSelectedGameId}
            {...game}
          />
        );
      })}
    </div>
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
      throw new Error(`unsupported format: ${format}`);
  }
}

const NewRoundButton: FC<{
  tournamentId: string;
  roundNumber: number;
  format: TournamentFormat;
}> = ({ tournamentId, roundNumber, format }) => {
  const t = useTranslations('Tournament.Round');
  const { data: tournamentGames } = useTournamentGames(tournamentId);
  const queryClient = useQueryClient();
  const { setRoundInView } = useContext(DashboardRoundContext);

  const { mutate, isPending: mutating } = useSaveRound({
    isTournamentGoing: true,
    setRoundInView,
  });
  const trpc = useTRPC();

  const newRound = () => {
    const players = queryClient.getQueryData(
      trpc.tournament.playersIn.queryKey({ tournamentId }),
    );
    const games = tournamentGames;
    if (!players || !games) return;
    const newGames = generateRound(format, {
      players,
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

const ActionButton = ({
  renderNewRoundButton,
  roundNumber,
  roundsNumber,
  tournamentId,
  renderFinishButton,
  format,
}: {
  renderNewRoundButton: boolean;
  roundNumber: number;
  roundsNumber: number | null;
  tournamentId: string;
  renderFinishButton: boolean;
  format: TournamentFormat;
}) => {
  if (!roundsNumber) return null;
  if (renderNewRoundButton)
    return (
      <NewRoundButton
        tournamentId={tournamentId}
        roundNumber={roundNumber}
        format={format}
      />
    );
  if (renderFinishButton)
    return (
      <div className="md:hidden">
        <FinishTournamentButton lastRoundNumber={roundsNumber} />
      </div>
    );

  return null;
};

const GamesIteratee = ({
  id,
  result,
  whiteNickname,
  blackNickname,
  whiteId,
  blackId,
  roundNumber,
  selected,
  setSelectedGameId,
}: GameModel & {
  selected: boolean;
  setSelectedGameId: Dispatch<SetStateAction<string | null>>;
}) => (
  <GameItem
    id={id}
    result={result}
    whiteId={whiteId}
    whiteNickname={whiteNickname}
    blackId={blackId}
    blackNickname={blackNickname}
    roundNumber={roundNumber}
    selected={selected}
    setSelectedGameId={setSelectedGameId}
  />
);

type RoundItemProps = {
  roundNumber: number;
  compact?: boolean;
};

export default RoundItem;
