import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useTournamentStart from '@/components/hooks/mutation-hooks/use-tournament-start';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { CirclePlay, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext } from 'react';

export default function StartTournamentButton() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data } = useTournamentInfo(id);
  const { sendJsonMessage } = useContext(DashboardContext);
  const { data: players } = useTournamentPlayers(id);
  const startTournamentMutation = useTournamentStart(queryClient, {
    id,
    sendJsonMessage,
  });
  const t = useTranslations('Tournament.Main');

  const handleClick = () => {
    if (!players) {
      throw new Error('NO_PLAYERS_DATA');
    }
    if (!data) {
      throw new Error('NO_TOURNAMENT_DATA');
    }
    if (players.length < 2) {
      throw new Error('NOT_ENOUGH_PLAYERS');
    }
    startTournamentMutation.mutate({
      startedAt: new Date(),
      tournamentId: data.tournament.id,
      format: data.tournament.format,
      roundsNumber: data.tournament.roundsNumber,
    });
  };

  return (
    <Button
      className="isolate-touch md:col-span-2"
      disabled={
        !players || players?.length < 2 || startTournamentMutation.isPending
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
