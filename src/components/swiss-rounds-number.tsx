'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { cn } from '@/lib/utils';
import useSaveRoundsNumberMutation from '@/components/hooks/mutation-hooks/use-tournament-update-swiss-rounds-number';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { getSwissMaxRoundsNumber, getSwissMinRoundsNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useContext } from 'react';

type SwissRoundsNumberProps = {
  className?: string;
};

export default function SwissRoundsNumber({
  className,
}: SwissRoundsNumberProps) {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data } = useTournamentInfo(tournamentId);
  const { data: players } = useTournamentPlayers(tournamentId);
  const queryClient = useQueryClient();
  const { sendJsonMessage, status } = useContext(DashboardContext);
  const { mutate, isPending } = useSaveRoundsNumberMutation(
    queryClient,
    sendJsonMessage,
  );

  const isOrganizer = status === 'organizer';
  const currentValue = data?.tournament.roundsNumber ?? 0;
  const playerCount = players?.length ?? 0;
  const minValue = getSwissMinRoundsNumber(playerCount);
  const maxValue = getSwissMaxRoundsNumber(playerCount);

  const canDecrement = currentValue > minValue;
  const canIncrement = currentValue < maxValue;

  const handleIncrement = () => {
    const newValue = currentValue + 1;
    mutate({ tournamentId, roundsNumber: newValue });
  };

  const handleDecrement = () => {
    const newValue = currentValue - 1;
    mutate({ tournamentId, roundsNumber: newValue });
  };

  if (!isOrganizer) {
    return <span className={className}>{currentValue}</span>;
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={isPending || !canDecrement}
        className={cn(
          'border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'flex h-8 w-8 items-center justify-center rounded border text-lg',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        −
      </button>
      <div
        className={cn(
          'border-input bg-background flex h-8 w-8 items-center justify-center rounded border text-center text-lg',
        )}
      >
        {currentValue}
      </div>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={isPending || !canIncrement}
        className={cn(
          'border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'flex h-8 w-8 items-center justify-center rounded border text-lg',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        +
      </button>
    </div>
  );
}
