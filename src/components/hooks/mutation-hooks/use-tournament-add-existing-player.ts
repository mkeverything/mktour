import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { baselinePlayerSort } from '@/lib/tournament-results';
import { PlayerTournamentModel } from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentAddExistingPlayer = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Errors');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  const mutationKey = trpc.tournament.addExistingPlayer.mutationKey();
  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const playersOutQueryKey = trpc.tournament.playersOut.queryKey({
    tournamentId,
  });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  return useMutation(
    trpc.tournament.addExistingPlayer.mutationOptions({
      onMutate: async ({ player, addedAt }) => {
        await queryClient.cancelQueries({ queryKey: playersQueryKey });
        await queryClient.cancelQueries({ queryKey: playersOutQueryKey });
        const previousState = queryClient.getQueryData(playersQueryKey);
        const nextPairingNumber = previousState?.length ?? 0;

        const newPlayer: PlayerTournamentModel = {
          id: player.id,
          nickname: player.nickname,
          rating: player.rating,
          realname: player.realname,
          wins: 0,
          losses: 0,
          draws: 0,
          colorIndex: 0,
          place: null,
          isOut: null,
          pairingNumber: nextPairingNumber,
          addedAt: addedAt ?? null,
          teamNickname: null,
          username: player.username,
          pairPlayers: null,
        };

        queryClient.setQueryData(playersQueryKey, (cache) => {
          if (!cache) return [newPlayer];
          if (cache.some((p) => p.id === newPlayer.id)) return cache;
          return cache.concat(newPlayer).sort(baselinePlayerSort);
        });
        queryClient.setQueryData(
          playersOutQueryKey,
          (cache) => cache && cache.filter((pl) => pl.id !== player.id),
        );
        return { previousState, newPlayer };
      },
      onError: (err, data, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(playersQueryKey, context.previousState);
        }
        console.log(err);
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
        queryClient.invalidateQueries({ queryKey: playersOutQueryKey });
        queryClient.invalidateQueries({ queryKey: roundGamesQueryKey });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.info.queryKey({ tournamentId }),
        });
      },
    }),
  );
};
