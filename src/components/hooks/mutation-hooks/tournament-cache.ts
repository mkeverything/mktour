'use client';

import { useTRPC } from '@/components/trpc/client';
import type { AppRouter } from '@/server/api';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import type { inferRouterInputs } from '@trpc/server';
import { useCallback } from 'react';

type TournamentInputs = inferRouterInputs<AppRouter>['tournament'];

// only procedures whose input carries a tournamentId can be tracked
type TournamentScopedProcedure = {
  [K in keyof TournamentInputs]: TournamentInputs[K] extends {
    tournamentId: string;
  }
    ? K
    : never;
}[keyof TournamentInputs];

type TournamentQuery =
  | 'info'
  | 'units'
  | 'playersOut'
  | 'roundGames'
  | 'allGames';

// single source of truth: which cached queries each mutation can dirty, on the
// server and/or optimistically. side-effects count too — e.g. removing a unit
// clamps roundsNumber, so it writes `info`.
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
  Record<TournamentScopedProcedure, readonly TournamentQuery[]>
>;

type TournamentCacheMutation = keyof typeof TOURNAMENT_CACHE_GRAPH;

const GRAPH_ENTRIES = Object.entries(TOURNAMENT_CACHE_GRAPH) as [
  TournamentCacheMutation,
  readonly TournamentQuery[],
][];

const hasTournamentId = (v: unknown): v is { tournamentId: string } =>
  typeof v === 'object' && v !== null && 'tournamentId' in v;

export const useTournamentCache = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // how many in-flight mutations of this tournament can dirty the query.
  const pendingWriters = useCallback(
    (query: TournamentQuery) =>
      GRAPH_ENTRIES.filter(([, queries]) => queries.includes(query)).reduce(
        (count, [mutation]) =>
          count +
          queryClient.isMutating({
            mutationKey: trpc.tournament[mutation].mutationKey(),
            predicate: ({ state }) =>
              hasTournamentId(state.variables) &&
              state.variables.tournamentId === tournamentId,
          }),
        0,
      ),
    [queryClient, trpc, tournamentId],
  );

  // called from onSettled: invalidate each query the mutation touched, but
  // only once no other writer can re-dirty it (self is the only pending one).
  // the partial-input key matches every cached shape for this tournament
  // (e.g. roundGames for any roundNumber).
  const settle = useCallback(
    (mutation: TournamentCacheMutation) => {
      for (const query of TOURNAMENT_CACHE_GRAPH[mutation]) {
        if (pendingWriters(query) !== 1) continue;
        const queryKey: QueryKey = trpc.tournament[query].queryKey({
          tournamentId,
        });
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [pendingWriters, queryClient, trpc, tournamentId],
  );

  return { pendingWriters, settle };
};
