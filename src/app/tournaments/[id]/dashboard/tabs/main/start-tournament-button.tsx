import { AppError } from '@/lib/errors';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentStart from '@/components/hooks/mutation-hooks/use-tournament-start';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentUnits } from '@/components/hooks/query-hooks/use-tournament-units';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { CirclePlay, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useContext } from 'react';

export default function StartTournamentButton() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data } = useTournamentInfo(id);
  const { sendJsonMessage } = useContext(DashboardContext);
  const { data: units } = useTournamentUnits(id);
  const startTournamentMutation = useTournamentStart(
    queryClient,
    id,
    sendJsonMessage,
  );
  const t = useTranslations('Tournament.Main');

  const handleClick = () => {
    if (!units) {
      throw new AppError('NO_UNITS_DATA');
    }
    if (!data) {
      throw new AppError('NO_TOURNAMENT_DATA');
    }
    if (units.length < 2) {
      throw new AppError('NOT_ENOUGH_TOURNAMENT_UNITS');
    }
    startTournamentMutation.mutate(
      {
        startedAt: new Date(),
        tournamentId: data.tournament.id,
        format: data.tournament.format,
        roundsNumber: data.tournament.roundsNumber,
      },
      {
        onSuccess: () => {
          posthog.capture('tournament_started', {
            tournament_id: data.tournament.id,
            format: data.tournament.format,
            rounds_number: data.tournament.roundsNumber,
            unit_count: units.length,
          });
        },
      },
    );
  };

  return (
    <Button
      className="isolate-touch md:col-span-2"
      disabled={
        !units || units?.length < 2 || startTournamentMutation.isPending
      }
      onClick={handleClick}
      size="lg"
    >
      {startTournamentMutation.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <CirclePlay />
      )}
      {t('start tournament')}
    </Button>
  );
}
