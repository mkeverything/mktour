import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useClubTournaments = (clubId: string) => {
  const trpc = useTRPC(); // TODO: use infinite query
  return useQuery(trpc.club.tournaments.queryOptions({ clubId }));
};
