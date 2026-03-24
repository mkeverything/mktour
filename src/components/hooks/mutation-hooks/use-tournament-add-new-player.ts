import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTRPC } from '@/components/trpc/client';
import { generateRandomRoundGames } from '@/lib/pairing-generators/random-pairs-generator';
import { newid } from '@/lib/utils';
import { PlayerFormModel, PlayerTournamentModel } from '@/server/zod/players';
import { baselinePlayerSort } from '@/lib/tournament-results';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentAddNewPlayer = (
  tournamentId: string,
  returnToNewPlayer: (_player: PlayerFormModel & { id?: string }) => void,
) => {
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const t = useTranslations('Errors');
  const saveRound = useSaveRound({
    isTournamentGoing: false,
  });
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.addNewPlayer.mutationOptions({
      onMutate: async ({ player, addedAt }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
        });
        const previousState: Array<PlayerTournamentModel> | undefined =
          queryClient.getQueryData(
            trpc.tournament.playersIn.queryKey({ tournamentId }),
          );
        const nextPairingNumber = previousState?.length ?? 0;

        const newPlayer: PlayerTournamentModel = {
          id: player.id ?? newid(),
          nickname: player.nickname,
          rating: player.rating,
          realname: player.realname ?? null,
          wins: 0,
          losses: 0,
          draws: 0,
          colorIndex: 0,
          place: null,
          isOut: null,
          pairingNumber: nextPairingNumber,
          addedAt: addedAt ?? null,
          teamNickname: null,
          username: null,
          pairPlayers: null,
        };

        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache: Array<PlayerTournamentModel> | undefined) => {
            if (!cache) return [newPlayer];
            if (cache.some((player) => player.id === newPlayer.id))
              return cache;
            return cache.concat(newPlayer).sort(baselinePlayerSort);
          },
        );
        return { previousState, newPlayer };
      },
      onError: (_err, data, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(
            trpc.tournament.playersIn.queryKey({ tournamentId }),
            context.previousState,
          );
        }
        returnToNewPlayer(data.player);
        toast.error(t('add-player-error', { player: data.player.nickname }), {
          id: `add-player-error-${data.player.id}`,
        });
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.addNewPlayer.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
          });
        }
      },
      onSuccess: (_err, _data, context) => {
        sendJsonMessage({ event: 'add-new-player', body: context.newPlayer });
        const players = queryClient.getQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
        );
        const newGames = generateRandomRoundGames({
          players: players
            ? players.map((player, i) => ({
                ...player,
                pairingNumber: i,
              }))
            : [],
          games: [],
          roundNumber: 1,
          tournamentId,
        });
        saveRound.mutate({ tournamentId, roundNumber: 1, newGames });
        queryClient.setQueryData(
          trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber: 1,
          }),
          () => newGames.sort((a, b) => a.gameNumber - b.gameNumber),
        );
      },
    }),
  );
};
