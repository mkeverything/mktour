import { useTRPC } from '@/components/trpc/client';
import { TournamentsListFiltersModel } from '@/server/zod/discovery';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export const useTournamentStatusCounts = (
  filters: TournamentsListFiltersModel,
  enabled = true,
) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.tournament.statusCounts.queryOptions(filters, {
      enabled,
      placeholderData: keepPreviousData,
    }),
  );
};
