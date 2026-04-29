import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { baselinePlayerSort } from '@/lib/tournament-results';
import { newid } from '@/lib/utils';
import { PlayerFormModel, PlayerTournamentModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentAddNewPlayer = (
  tournamentId: string,
  returnToNewPlayer: (_player: PlayerFormModel & { id?: string }) => void,
) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Errors');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  const mutationKey = trpc.tournament.addNewPlayer.mutationKey();
  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  return useMutation(
    trpc.tournament.addNewPlayer.mutationOptions({
      onMutate: async ({ player, addedAt }) => {
        await queryClient.cancelQueries({ queryKey: playersQueryKey });
        const previousState: Array<PlayerTournamentModel> | undefined =
          queryClient.getQueryData(playersQueryKey);
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
          playersQueryKey,
          (cache: Array<PlayerTournamentModel> | undefined) => {
            if (!cache) return [newPlayer];
            if (cache.some((p) => p.id === newPlayer.id)) return cache;
            return cache.concat(newPlayer).sort(baselinePlayerSort);
          },
        );
        return { previousState, newPlayer };
      },
      onError: (_err, data, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(playersQueryKey, context.previousState);
        }
        returnToNewPlayer(data.player);
        toast.error(t('add-player-error', { player: data.player.nickname }), {
          id: `add-player-error-${data.player.id}`,
        });
      },
      onSuccess: (data) => {
        if (queryClient.isMutating({ mutationKey }) !== 1) return;
        queryClient.setQueryData(playersQueryKey, data.players);
        queryClient.setQueryData(roundGamesQueryKey, data.games);
        sendJsonMessage({
          event: 'prestart-round-updated',
          players: data.players,
          games: data.games,
          roundNumber: 1,
        });
      },
      onSettled: () => {
        if (queryClient.isMutating({ mutationKey }) !== 1) return;
        queryClient.invalidateQueries({ queryKey: playersQueryKey });
        queryClient.invalidateQueries({ queryKey: roundGamesQueryKey });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });
      },
    }),
  );
};
