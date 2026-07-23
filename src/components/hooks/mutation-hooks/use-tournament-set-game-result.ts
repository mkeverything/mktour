'use client';

import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { GameResult } from '@/server/zod/enums';
import { UnitModel } from '@/server/zod/tournaments';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentSetGameResult({
  tournamentId,
  roundNumber,
  sendJsonMessage,
}: SetResultProps) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { settle } = useTournamentCache(tournamentId);
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
        function updatePlayerStats(
          player: UnitModel,
          gameResult: GameResult,
          isWhite: boolean,
          modifier: 1 | -1,
        ) {
          const updatedPlayer = { ...player };

          if (gameResult === '1-0') {
            if (isWhite) {
              updatedPlayer.wins = (updatedPlayer.wins || 0) + modifier;
            } else {
              updatedPlayer.losses = (updatedPlayer.losses || 0) + modifier;
            }
          } else if (gameResult === '0-1') {
            if (isWhite) {
              updatedPlayer.losses = (updatedPlayer.losses || 0) + modifier;
            } else {
              updatedPlayer.wins = (updatedPlayer.wins || 0) + modifier;
            }
          } else {
            updatedPlayer.draws = (updatedPlayer.draws || 0) + modifier;
          }
          return updatedPlayer;
        }

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
          queryClient.setQueryData(
            trpc.tournament.units.queryKey({ tournamentId }),
            (players) => {
              if (!players) return players;
              return players.map((player) => {
                const isWhite = player.id === cachedGame.whiteUnitId;
                const isBlack = player.id === cachedGame.blackUnitId;
                if (!isWhite && !isBlack) return player;

                let updatedPlayer = player;
                if (cachedGame.result) {
                  updatedPlayer = updatePlayerStats(
                    updatedPlayer,
                    cachedGame.result,
                    isWhite,
                    -1,
                  );
                }
                if (result) {
                  updatedPlayer = updatePlayerStats(
                    updatedPlayer,
                    result,
                    isWhite,
                    1,
                  );
                }
                return updatedPlayer;
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
  sendJsonMessage: (_message: DashboardMessage) => void;
};
