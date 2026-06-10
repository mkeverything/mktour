import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useTournamentGames = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.tournament.allGames.queryOptions({ tournamentId }));
};
