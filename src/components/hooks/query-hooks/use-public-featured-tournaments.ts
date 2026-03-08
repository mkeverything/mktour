'use client';

import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const usePublicFeaturedTournaments = (limit = 5) => {
  const trpc = useTRPC();
  return useQuery(trpc.tournament.publicFeatured.queryOptions({ limit }));
};
