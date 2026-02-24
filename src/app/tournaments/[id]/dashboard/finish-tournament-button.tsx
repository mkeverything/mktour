import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentFinish from '@/components/hooks/mutation-hooks/use-tournament-finish';
import { useTournamentRoundGames } from '@/components/hooks/query-hooks/use-tournament-round-games';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext } from 'react';

export default function FinishTournamentButton({
  lastRoundNumber,
  className,
}: {
  lastRoundNumber: number;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { id: tournamentId } = useParams<{ id: string }>();
  const { sendJsonMessage } = useContext(DashboardContext);
  const t = useTranslations('Tournament.Main');
  const { data: round } = useTournamentRoundGames({
    tournamentId,
    roundNumber: lastRoundNumber,
  });

  const { mutate, isPending } = useTournamentFinish(queryClient, {
    tournamentId,
    sendJsonMessage,
  });

  if (!round) return null;

  const ongoingGames = round.reduce(
    (acc, current) => (current.result === null ? acc + 1 : acc),
    0,
  );

  if (!!ongoingGames) return null;

  return (
    <Button
      onClick={() => mutate({ tournamentId, closedAt: new Date() })}
      disabled={isPending}
      className={className}
    >
      {isPending ? <LoadingSpinner /> : <Save />}
      {t('finish tournament')}
    </Button>
  );
}
