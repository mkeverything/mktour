'use client';

import type { TournamentQuery } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { applyManualUnitOrder } from '@/lib/reorder-tournament-units';
import { baselineUnitSort } from '@/lib/tournament-results';
import { settlePendingGamesAsForfeit } from '@/lib/utils';
import type { TournamentEventModel } from '@/server/zod/events';
import { QueryClient } from '@tanstack/react-query';
import { Dispatch, SetStateAction } from 'react';

// a query this client is still writing is skipped: its last pending mutation
// refetches it when it settles
export const handleTournamentEvent = (
  event: TournamentEventModel,
  {
    queryClient,
    trpc,
    tournamentId,
    pendingWriters,
    refresh,
    setRoundInView,
    onDeleted,
  }: TournamentEventContext,
) => {
  const idle = (query: TournamentQuery) => pendingWriters(query) === 0;
  const infoKey = trpc.tournament.info.queryKey({ tournamentId });
  const unitsKey = trpc.tournament.units.queryKey({ tournamentId });
  const allGamesKey = trpc.tournament.allGames.queryKey({ tournamentId });
  const roundGamesKey = (roundNumber: number) =>
    trpc.tournament.roundGames.queryKey({ tournamentId, roundNumber });

  switch (event.event) {
    case 'prestart-units-updated': {
      const units = applyManualUnitOrder(event.units);
      if (idle('units')) queryClient.setQueryData(unitsKey, units);
      if (idle('roundGames')) {
        queryClient.setQueryData(
          roundGamesKey(1),
          generatePreStartRoundGames({ units, tournamentId }),
        );
      }
      refresh(['units', 'roundGames', 'allGames', 'playersOut', 'info']);
      break;
    }
    case 'withdraw-unit': {
      if (idle('units')) {
        queryClient.setQueryData(unitsKey, (cache) =>
          cache?.map((unit) =>
            unit.id === event.id ? { ...unit, isOut: true } : unit,
          ),
        );
      }
      if (idle('allGames')) {
        queryClient.setQueryData(
          allGamesKey,
          (cache) => cache && settlePendingGamesAsForfeit(cache, event.id),
        );
      }
      const ongoingRound =
        queryClient.getQueryData(infoKey)?.tournament.ongoingRound;
      if (ongoingRound != null && idle('roundGames')) {
        queryClient.setQueryData(
          roundGamesKey(ongoingRound),
          (cache) => cache && settlePendingGamesAsForfeit(cache, event.id),
        );
      }
      refresh(['units', 'roundGames', 'allGames', 'playersOut', 'info']);
      break;
    }
    case 'set-game-result':
      if (idle('roundGames')) {
        queryClient.setQueryData(roundGamesKey(event.roundNumber), (cache) =>
          cache?.map((game) =>
            game.id === event.gameId ? { ...game, result: event.result } : game,
          ),
        );
      }
      refresh(['roundGames', 'units', 'allGames']);
      break;
    case 'start-tournament':
      if (idle('info')) {
        queryClient.setQueryData(
          infoKey,
          (cache) =>
            cache && {
              ...cache,
              tournament: { ...cache.tournament, startedAt: event.startedAt },
            },
        );
      }
      if (idle('roundGames')) {
        queryClient.setQueryData(roundGamesKey(1), event.games);
      }
      if (idle('allGames')) queryClient.setQueryData(allGamesKey, event.games);
      refresh(['info', 'allGames']);
      break;
    case 'reset-tournament': {
      if (idle('info')) {
        queryClient.setQueryData(
          infoKey,
          (cache) =>
            cache && {
              ...cache,
              tournament: { ...cache.tournament, startedAt: null },
            },
        );
      }
      if (idle('allGames')) queryClient.setQueryData(allGamesKey, []);
      const units = queryClient
        .getQueryData(unitsKey)
        ?.toSorted(baselineUnitSort);
      if (units && idle('units')) queryClient.setQueryData(unitsKey, units);
      if (units && idle('roundGames')) {
        queryClient.setQueryData(
          roundGamesKey(1),
          generatePreStartRoundGames({ units, tournamentId }),
        );
      }
      refresh(['info', 'allGames', 'roundGames', 'units']);
      setRoundInView(1);
      break;
    }
    case 'reset-tournament-players':
      if (idle('units')) queryClient.setQueryData(unitsKey, []);
      if (idle('allGames')) queryClient.setQueryData(allGamesKey, []);
      if (idle('roundGames')) queryClient.setQueryData(roundGamesKey(1), []);
      break;
    case 'new-round':
      if (idle('roundGames')) {
        queryClient.setQueryData(
          roundGamesKey(event.roundNumber),
          event.newGames,
        );
      }
      refresh(['allGames', 'info']);
      setRoundInView(event.roundNumber);
      break;
    case 'finish-tournament':
      if (idle('info')) {
        queryClient.setQueryData(
          infoKey,
          (cache) =>
            cache && {
              ...cache,
              tournament: { ...cache.tournament, closedAt: event.closedAt },
            },
        );
      }
      refresh(['info']);
      break;
    case 'swiss-new-rounds-number':
      if (idle('info')) {
        queryClient.setQueryData(
          infoKey,
          (cache) =>
            cache && {
              ...cache,
              tournament: {
                ...cache.tournament,
                roundsNumber: event.roundsNumber,
              },
            },
        );
      }
      refresh(['info']);
      break;
    case 'tournament-title-changed':
      if (idle('info')) {
        queryClient.setQueryData(
          infoKey,
          (cache) =>
            cache && {
              ...cache,
              tournament: { ...cache.tournament, title: event.title },
            },
        );
      }
      break;
    case 'delete-tournament':
      // the client that deleted it leaves through its own mutation
      if (
        !queryClient.isMutating({
          mutationKey: trpc.tournament.delete.mutationKey(),
        })
      )
        onDeleted();
      break;
  }
};

type TournamentEventContext = {
  queryClient: QueryClient;
  trpc: ReturnType<typeof useTRPC>;
  tournamentId: string;
  pendingWriters: (query: TournamentQuery) => number;
  refresh: (queries: readonly TournamentQuery[]) => void;
  setRoundInView: Dispatch<SetStateAction<number>>;
  onDeleted: () => void;
};
