'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useSaveRoundsNumberMutation from '@/components/hooks/mutation-hooks/use-tournament-update-swiss-rounds-number';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTournamentPlayers } from '@/components/hooks/query-hooks/use-tournament-players';
import { cn, getSwissMaxRoundsNumber } from '@/lib/utils';
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
  const { mutate } = useSaveRoundsNumberMutation(queryClient, sendJsonMessage);

  const isOrganizer = status === 'organizer';
  const currentValue = data?.tournament.roundsNumber ?? 1;
  const playerCount = players?.length ?? 0;
  const minValue = 1;
  const maxValue = getSwissMaxRoundsNumber(playerCount);
  const boundedCurrentValue = Math.min(
    Math.max(currentValue, minValue),
    maxValue,
  );

  const canDecrement = boundedCurrentValue > minValue;
  const canIncrement = boundedCurrentValue < maxValue;

  const handleIncrement = () => {
    if (!canIncrement) return;
    const newValue = boundedCurrentValue + 1;
    mutate({ tournamentId, roundsNumber: newValue });
  };

  const handleDecrement = () => {
    if (!canDecrement) return;
    const newValue = boundedCurrentValue - 1;
    mutate({ tournamentId, roundsNumber: newValue });
  };

  if (!isOrganizer) {
    return <span className={className}>{boundedCurrentValue}</span>;
  }

  return (
    <div
      className={cn('text-primary inline-flex items-center gap-2', className)}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={!canDecrement}
        className={cn(
          'border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'flex size-8 items-center justify-center rounded border text-lg',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        -
      </button>
      <div
        className={cn(
          'border-input bg-background flex size-8 items-center justify-center rounded border text-center',
        )}
      >
        {boundedCurrentValue}
      </div>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={!canIncrement}
        className={cn(
          'border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'flex size-8 items-center justify-center rounded border text-lg',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        +
      </button>
    </div>
  );
}
