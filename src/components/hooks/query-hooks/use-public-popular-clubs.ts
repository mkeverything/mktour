'use client';

import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const usePublicPopularClubs = (limit = 5) => {
  const trpc = useTRPC();
  return useQuery(trpc.club.publicPopular.queryOptions({ limit }));
};
