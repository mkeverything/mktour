'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useOptimisticPreStartRound } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-optimistic-pre-start-round';
import { useTRPC } from '@/components/trpc/client';
import type { preStartStateSchema } from '@/server/zod/tournaments';
import { useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import type { z } from 'zod';

type PreStartState = z.infer<typeof preStartStateSchema>;

export const useSharedPreStart = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const optimisticPreStartRound = useOptimisticPreStartRound(tournamentId);

  const keys = {
    units: trpc.tournament.units.queryKey({ tournamentId }),
    playersOut: trpc.tournament.playersOut.queryKey({ tournamentId }),
    roundGames: trpc.tournament.roundGames.queryKey({
      tournamentId,
      roundNumber: 1,
    }),
    allGames: trpc.tournament.allGames.queryKey({ tournamentId }),
    info: trpc.tournament.info.queryKey({ tournamentId }),
  };

  const applyServerPreStartState = (data: PreStartState) => {
    queryClient.setQueryData(keys.units, data.units);
    queryClient.setQueryData(keys.roundGames, data.games);
    sendJsonMessage({
      event: 'prestart-round-updated',
      units: data.units,
      games: data.games,
      roundNumber: 1,
    });
  };

  const applyServerPreStartStateIfLatest = (data: PreStartState) => {
    if (!optimisticPreStartRound.isOnlyPendingPreStartRoundMutation()) return;
    applyServerPreStartState(data);
  };

  const invalidatePreStartState = (
    options: { playersOut?: boolean; info?: boolean; allGames?: boolean } = {},
  ) => {
    if (!optimisticPreStartRound.isOnlyPendingPreStartRoundMutation()) return;

    if (options.playersOut) {
      queryClient.invalidateQueries({ queryKey: keys.playersOut });
    }
    if (options.allGames ?? true) {
      queryClient.invalidateQueries({ queryKey: keys.allGames });
    }
    if (options.info ?? true) {
      queryClient.invalidateQueries({ queryKey: keys.info });
    }
  };

  return {
    keys,
    ...optimisticPreStartRound,
    applyServerPreStartState,
    applyServerPreStartStateIfLatest,
    invalidatePreStartState,
  };
};
