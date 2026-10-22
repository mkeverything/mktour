import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useClubLocations = (search?: string, enabled = true) => {
  const trpc = useTRPC();
  return useQuery(trpc.club.locations.queryOptions({ search }, { enabled }));
};
