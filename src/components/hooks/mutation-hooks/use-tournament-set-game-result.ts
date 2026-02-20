'use client';

import { useTRPC } from '@/components/trpc/client';
import { PlayerTournamentModel } from '@/server/db/zod/players';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useTournamentSetGameResult(
  queryClient: QueryClient,
  { tournamentId, sendJsonMessage }: SetResultProps,
) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.setGameResult.mutationOptions({
      onMutate: async ({ roundNumber }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
        });
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
        });
      },
      onSuccess: (
        _res,
        { gameId, result, roundNumber, prevResult, whiteId, blackId },
      ) => {
        function updatePlayerStats(
          player: PlayerTournamentModel,
          result: string,
          isWhite: boolean,
          isReset: boolean,
        ) {
          const modifier = isReset ? -1 : 1;

          const updatedPlayer = { ...player };

          if (result === '1-0') {
            if (isWhite) {
              updatedPlayer.wins = (updatedPlayer.wins || 0) + modifier;
            } else {
              updatedPlayer.losses = (updatedPlayer.losses || 0) + modifier;
            }
          } else if (result === '0-1') {
            if (isWhite) {
              updatedPlayer.losses = (updatedPlayer.losses || 0) + modifier;
            } else {
              updatedPlayer.wins = (updatedPlayer.wins || 0) + modifier;
            }
          } else if (result === '1/2-1/2') {
            updatedPlayer.draws = (updatedPlayer.draws || 0) + modifier;
          }
          return updatedPlayer;
        }

        // as soon as we made games order dependent on player scores,
        // we need to update their scores at the same time as we update games
        // otherwise ui flickers and adds wrong order for a moment
        // while games are updated and players are being refetched
        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (players) => {
            if (!players || !result) return players;
            return players.map((player) => {
              // Case 1: Toggling the same result (reset)
              if (prevResult === result) {
                if (player.id === whiteId) {
                  return updatePlayerStats(player, result, true, true);
                }
                if (player.id === blackId) {
                  return updatePlayerStats(player, result, false, true);
                }
              }
              // Case 2: Changing from one result to another
              else if (prevResult && prevResult !== result) {
                if (player.id === whiteId) {
                  // First remove old result
                  const updated = updatePlayerStats(
                    player,
                    prevResult,
                    true,
                    true,
                  );
                  // Then add new result
                  return updatePlayerStats(updated, result, true, false);
                }
                if (player.id === blackId) {
                  // First remove old result
                  const updated = updatePlayerStats(
                    player,
                    prevResult,
                    false,
                    true,
                  );
                  // Then add new result
                  return updatePlayerStats(updated, result, false, false);
                }
              }
              // Case 3: Adding a new result where none existed before
              else if (!prevResult && result) {
                if (player.id === whiteId) {
                  return updatePlayerStats(player, result, true, false);
                }
                if (player.id === blackId) {
                  return updatePlayerStats(player, result, false, false);
                }
              }
              return player;
            });
          },
        );

        queryClient.setQueryData(
          trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
          (cache) => {
            if (!cache) return cache;
            return cache.map((game) => {
              if (game.id === gameId) {
                return {
                  ...game,
                  result: game.result === result ? null : result,
                };
              }
              return game;
            });
          },
        );
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.setGameResult.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.roundGames.queryKey({
              tournamentId,
              roundNumber,
            }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
          });
        }
        sendJsonMessage({
          event: 'set-game-result',
          gameId,
          result,
          roundNumber,
        });
      },
      onError: (error) => {
        toast.error(t('server error'));
        console.log(error);
      },
    }),
  );
}

type SetResultProps = {
  tournamentId: string | undefined;
  sendJsonMessage: (_message: DashboardMessage) => void;
};
