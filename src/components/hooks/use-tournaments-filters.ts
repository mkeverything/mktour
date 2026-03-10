import { useCallback, useMemo, useState } from 'react';

import type {
  TournamentFormat,
  TournamentStatus,
  TournamentType,
} from '@/server/zod/enums';

import type { TournamentsFilterInput } from '@/components/hooks/query-hooks/use-tournaments';

export const useTournamentsFilters = () => {
  const [filters, setFilters] =
    useState<TournamentsFiltersState>(DEFAULT_FILTERS);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const setRated = useCallback((rated: Rated) => {
    setFilters((prev) => ({ ...prev, rated }));
  }, []);

  const setFormats = useCallback((formats: TournamentFormat[]) => {
    setFilters((prev) => ({ ...prev, formats }));
  }, []);

  const setTypes = useCallback((types: TournamentType[]) => {
    setFilters((prev) => ({ ...prev, types }));
  }, []);

  const setStatus = useCallback((status: TournamentStatus[]) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const touched = useMemo(() => {
    return (
      !!filters.search.length ||
      !!filters.formats.length ||
      !!filters.types.length ||
      !!filters.status.length ||
      !!filters.rated
    );
  }, [filters]);

  const queryFilter: TournamentsFilterInput = useMemo(
    () => ({
      search: filters.search.trim().length ? filters.search.trim() : undefined,
      rated: filters.rated ?? undefined,
      formats: filters.formats.length ? filters.formats : undefined,
      types: filters.types.length ? filters.types : undefined,
      statuses: filters.status.length ? filters.status : undefined,
    }),
    [filters],
  );

  return {
    search: filters.search,
    rated: filters.rated,
    formats: filters.formats,
    types: filters.types,
    status: filters.status,
    setSearch,
    setRated,
    setFormats,
    setTypes,
    setStatus,
    reset,
    touched,
    queryFilter,
  };
};

export type Rated = boolean | null;

type TournamentsFiltersState = {
  search: string;
  rated: Rated;
  formats: TournamentFormat[];
  types: TournamentType[];
  status: TournamentStatus[];
};

const DEFAULT_FILTERS: TournamentsFiltersState = {
  search: '',
  rated: null,
  formats: [],
  types: [],
  status: [],
};
