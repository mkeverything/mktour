import { useTRPC } from '@/components/trpc/client';
import type {
  TournamentFormat,
  TournamentStatus,
  TournamentType,
} from '@/server/zod/enums';
import { useInfiniteQuery } from '@tanstack/react-query';

export type TournamentsFilterInput = {
  search?: string;
  rated?: boolean | null;
  formats?: TournamentFormat[];
  types?: TournamentType[];
  statuses?: TournamentStatus[];
};

export const useTournaments = (filter: TournamentsFilterInput) => {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.tournament.all.infiniteQueryOptions(
      {
        cursor: undefined,
        search: filter.search,
        rated: filter.rated ?? undefined,
        formats: filter.formats,
        types: filter.types,
        statuses: filter.statuses,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
};
