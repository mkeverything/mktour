import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useTournamentUnits = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.tournament.units.queryOptions({ tournamentId }));
};

export const useTournamentActiveUnitsCount = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.tournament.units.queryOptions({ tournamentId }),
    select: (units) => units.filter((unit) => !unit.isOut).length,
  });
};
