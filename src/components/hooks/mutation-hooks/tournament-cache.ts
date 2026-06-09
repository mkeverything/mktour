'use client';

import { useTRPC } from '@/components/trpc/client';
import type { AppRouter } from '@/server/api';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import type { inferRouterInputs } from '@trpc/server';
import { useCallback, useMemo } from 'react';

type TournamentProcedure = keyof inferRouterInputs<AppRouter>['tournament'];

// the dashboard's cached read surface.
const TOURNAMENT_QUERIES = [
  'info',
  'units',
  'playersOut',
  'roundGames',
  'allGames',
] as const satisfies readonly TournamentProcedure[];
type TournamentQuery = (typeof TOURNAMENT_QUERIES)[number];

// single source of truth: which cached queries each mutation can dirty, on the
// server and/or optimistically. side-effects count too — e.g. removing a unit
// clamps roundsNumber, so it writes `info`. everything else (writer lookup,
// invalidation timing) is derived from this map
const TOURNAMENT_CACHE_GRAPH = {
  addSoloUnit: ['units', 'roundGames', 'allGames', 'playersOut', 'info'],
  addNewSoloUnit: ['units', 'roundGames', 'allGames', 'info'],
  addDoublesUnit: ['units', 'roundGames', 'allGames', 'playersOut', 'info'],
  editDoublesUnit: ['units', 'roundGames', 'allGames', 'playersOut', 'info'],
  removeUnit: ['units', 'roundGames', 'allGames', 'playersOut', 'info'],
  reorderUnits: ['units', 'roundGames', 'allGames'],
  // lifecycle transitions.
  withdrawUnit: ['units', 'roundGames', 'allGames', 'info'],
  resetPlayers: ['units', 'roundGames', 'allGames', 'playersOut', 'info'],
  reset: ['units', 'roundGames', 'allGames', 'info'],
  start: ['units', 'roundGames', 'allGames', 'info'],
  finish: ['units', 'info'],
  // in-progress play.
  setGameResult: ['units', 'roundGames', 'allGames'],
  saveRound: ['roundGames', 'allGames', 'info'],
  // tournament.info metadata edits.
  editTitle: ['info'],
  updateSwissRoundsNumber: ['info'],
} as const satisfies Partial<
  Record<TournamentProcedure, readonly TournamentQuery[]>
>;

type TournamentCacheMutation = keyof typeof TOURNAMENT_CACHE_GRAPH;

export const useTournamentCache = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // inverse of the graph: query -> mutations that can dirty it.
  const writersByQuery = useMemo(() => {
    const map = {} as Record<TournamentQuery, TournamentCacheMutation[]>;
    for (const query of TOURNAMENT_QUERIES) map[query] = [];
    for (const mutation of Object.keys(
      TOURNAMENT_CACHE_GRAPH,
    ) as TournamentCacheMutation[]) {
      for (const query of TOURNAMENT_CACHE_GRAPH[mutation]) {
        map[query].push(mutation);
      }
    }
    return map;
  }, []);

  // how many writers of this query are still in flight.
  const pendingWriters = useCallback(
    (query: TournamentQuery) =>
      writersByQuery[query].reduce(
        (count, mutation) =>
          count +
          queryClient.isMutating({
            mutationKey: trpc.tournament[mutation].mutationKey(),
          }),
        0,
      ),
    [writersByQuery, queryClient, trpc],
  );

  // a partial-input query key, so invalidation partial-matches every cached
  // shape for this tournament (e.g. roundGames for any roundNumber). widened to
  // QueryKey to drop the per-procedure output tag the union can't reconcile.
  const invalidateQuery = useCallback(
    (query: TournamentQuery) => {
      const queryKey: QueryKey = trpc.tournament[query].queryKey({
        tournamentId,
      });
      return queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, trpc, tournamentId],
  );

  // invalidate each query a mutation touched, but only once no other writer can
  // still re-dirty it (self is the only pending writer). called from onSettled.
  const settle = useCallback(
    (mutation: TournamentCacheMutation) => {
      for (const query of TOURNAMENT_CACHE_GRAPH[mutation]) {
        if (pendingWriters(query) === 1) invalidateQuery(query);
      }
    },
    [pendingWriters, invalidateQuery],
  );

  return { pendingWriters, invalidateQuery, settle };
};
