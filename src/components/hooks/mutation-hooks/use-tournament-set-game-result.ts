'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { getUnitResultDeltas } from '@/lib/game-result-deltas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export default function useTournamentSetGameResult({
  tournamentId,
  roundNumber,
}: SetResultProps) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { settle } = useTournamentCache(tournamentId);
  const { sendJsonMessage } = useContext(DashboardContext);
  return useMutation(
    trpc.tournament.setGameResult.mutationOptions({
      meta: { tournamentId },
      onMutate: async () => {
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
        });
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.units.queryKey({ tournamentId }),
        });
      },
      onSuccess: (_res, { gameId, result }) => {
        const roundGamesKey = trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber,
        });
        const cachedGame = queryClient
          .getQueryData(roundGamesKey)
          ?.find((game) => game.id === gameId);

        // as soon as we made games order dependent on player scores,
        // we need to update their scores at the same time as we update games
        // otherwise ui flickers and adds wrong order for a moment
        // while games are updated and players are being refetched
        if (cachedGame && cachedGame.result !== result) {
          const deltas = getUnitResultDeltas(cachedGame.result, result);
          queryClient.setQueryData(
            trpc.tournament.units.queryKey({ tournamentId }),
            (units) => {
              if (!units) return units;
              return units.map((unit) => {
                const delta =
                  unit.id === cachedGame.whiteUnitId
                    ? deltas.white
                    : unit.id === cachedGame.blackUnitId
                      ? deltas.black
                      : null;
                if (!delta) return unit;

                return {
                  ...unit,
                  wins: unit.wins + delta.wins,
                  draws: unit.draws + delta.draws,
                  losses: unit.losses + delta.losses,
                  colorIndex: unit.colorIndex + delta.colorIndex,
                };
              });
            },
          );
        }

        queryClient.setQueryData(roundGamesKey, (cache) => {
          if (!cache) return cache;
          return cache.map((game) =>
            game.id === gameId ? { ...game, result } : game,
          );
        });
        sendJsonMessage({
          event: 'set-game-result',
          gameId,
          result,
          roundNumber,
        });
      },
      onSettled: () => settle('setGameResult'),
      onError: (error) => {
        toast.error(tErrors(getAppErrorMessage(error)));
        console.log(error);
      },
    }),
  );
}

type SetResultProps = {
  tournamentId: string;
  roundNumber: number;
};
