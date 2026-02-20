'use client';
import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import GameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/game-item';
import Center from '@/components/center';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { useRoundData } from '@/components/hooks/use-round-data';
import SkeletonList from '@/components/skeleton-list';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import { generateRoundRobinRound } from '@/lib/pairing-generators/round-robin-generator';
import { GameModel } from '@/server/db/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useContext } from 'react';

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
  const info = useTournamentInfo(tournamentId);
  const { data: players } = useTournamentPlayers(tournamentId);
  const { status } = useContext(DashboardContext);
  const { sortedRound, ongoingGames } = useRoundData(round, players);

  if (isLoading || !info.data || !players)
    return (
      <div className="px-4 pt-2">
        <SkeletonList length={8} />
      </div>
    );

  if (isError) return <Center>error</Center>;
  if (!round) return <Center>no round</Center>;

  const { ongoingRound, roundsNumber, closedAt } = info.data.tournament;
  const renderFinishButton =
    status === 'organizer' && !closedAt && ongoingRound === roundsNumber;
  const renderNewRoundButton =
    roundNumber === ongoingRound &&
    ongoingRound !== roundsNumber &&
    ongoingGames === 0 &&
    status === 'organizer' &&
    round.length > 0;

  return (
    <div className="mk-list mk-container px-mk pt-2">
      <ActionButton
        renderNewRoundButton={renderNewRoundButton}
        roundNumber={roundNumber}
        roundsNumber={roundsNumber}
        tournamentId={tournamentId}
        renderFinishButton={renderFinishButton}
      />
      {sortedRound.map((game, index) => {
        return <GamesIteratee key={index} {...game} />;
      })}
    </div>
  );
};

const NewRoundButton: FC<{ tournamentId: string; roundNumber: number }> = ({
  tournamentId,
  roundNumber,
}) => {
  const t = useTranslations('Tournament.Round');
  const { data: tournamentGames } = useTournamentGames(tournamentId);
  const queryClient = useQueryClient();
  const { sendJsonMessage, setRoundInView } = useContext(DashboardContext);

  const { mutate, isPending: mutating } = useSaveRound({
    queryClient,
    sendJsonMessage,
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
    const newGames = generateRoundRobinRound({
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
}: {
  renderNewRoundButton: boolean;
  roundNumber: number;
  roundsNumber: number | null;
  tournamentId: string;
  renderFinishButton: boolean;
}) => {
  if (!roundsNumber) return null;
  if (renderNewRoundButton)
    return (
      <NewRoundButton tournamentId={tournamentId} roundNumber={roundNumber} />
    );
  if (renderFinishButton)
    return <FinishTournamentButton lastRoundNumber={roundsNumber} />;
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
}: GameModel) => (
  <GameItem
    id={id}
    result={result}
    playerLeft={{ whiteId, whiteNickname }}
    playerRight={{ blackId, blackNickname }}
    roundNumber={roundNumber}
  />
);

type RoundItemProps = {
  roundNumber: number;
  compact?: boolean;
};

export default RoundItem;
