'use client';

import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
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
import { FC, useContext } from 'react';

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

export interface RoundActionButtonProps {
  renderNewRoundButton: boolean;
  roundNumber: number;
  roundsNumber: number | null;
  tournamentId: string;
  renderFinishButton: boolean;
  format: TournamentFormat;
}

const RoundActionButton: FC<RoundActionButtonProps> = ({
  renderNewRoundButton,
  roundNumber,
  roundsNumber,
  tournamentId,
  renderFinishButton,
  format,
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
    const newGames = generateRound(format, {
      players,
      games,
      roundNumber: roundNumber + 1,
      tournamentId,
    });
    mutate({ tournamentId, roundNumber: roundNumber + 1, newGames });
  };

  if (!roundsNumber) return null;
  if (renderNewRoundButton)
    return (
      <Button className="w-full" onClick={newRound} disabled={mutating}>
        {!mutating ? <ArrowRightIcon /> : <LoadingSpinner />}
        {t('new round button')}
      </Button>
    );
  if (renderFinishButton)
    return (
      <div className="md:hidden">
        <FinishTournamentButton lastRoundNumber={roundsNumber} />
      </div>
    );

  return null;
};

export default RoundActionButton;
