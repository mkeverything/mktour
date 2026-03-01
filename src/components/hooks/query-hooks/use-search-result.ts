import { useTRPC } from '@/components/trpc/client';
import { SearchParamsModel } from '@/server/db/zod/search';
import { useQuery } from '@tanstack/react-query';

export const useSearchQuery = (params: SearchParamsModel) => {
  const trpc = useTRPC();
  return useQuery(trpc.search.queryOptions(params));
};
