import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentFinish from '@/components/hooks/mutation-hooks/use-tournament-finish';
import { useTournamentGames } from '@/components/hooks/query-hooks/_use-tournament-games';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useContext } from 'react';

export default function FinishTournamentButton({
  className,
}: {
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { id: tournamentId } = useParams<{ id: string }>();
  const { sendJsonMessage } = useContext(DashboardContext);
  const t = useTranslations('Tournament.Main');
  const { data: allGames } = useTournamentGames(tournamentId);

  const { mutate, isPending } = useTournamentFinish(queryClient, {
    tournamentId,
    sendJsonMessage,
  });

  if (!allGames) return null;
  if (allGames.some((game) => game.result === null)) return null;

  return (
    <Button
      onClick={() => {
        mutate(
          { tournamentId, closedAt: new Date() },
          {
            onSuccess: () => {
              posthog.capture('tournament_finished', {
                tournament_id: tournamentId,
              });
            },
          },
        );
      }}
      disabled={isPending}
      className={`max-md:w-full ${className}`}
    >
      {isPending ? <LoadingSpinner /> : <Save />}
      {t('finish tournament')}
    </Button>
  );
}
