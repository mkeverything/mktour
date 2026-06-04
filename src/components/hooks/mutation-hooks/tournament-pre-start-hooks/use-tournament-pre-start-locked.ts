'use client';

import { useTRPC } from '@/components/trpc/client';
import { useIsMutating } from '@tanstack/react-query';

export const useTournamentPreStartLocked = (tournamentId: string) => {
  const trpc = useTRPC();

  return (
    useIsMutating({
      mutationKey: trpc.tournament.start.mutationKey(),
      predicate: (mutation) =>
        mutation.options.scope?.id === `tournament-pre-start:${tournamentId}`,
    }) > 0
  );
};
