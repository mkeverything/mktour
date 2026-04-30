import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { useOptimisticPreStartRound } from '@/components/hooks/mutation-hooks/use-optimistic-pre-start-round';
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
  const {
    applyOptimisticPreStartRound,
    isOnlyPendingPreStartRoundMutation,
    rollbackOptimisticPreStartRound,
  } = useOptimisticPreStartRound(tournamentId);
  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  return useMutation(
    trpc.tournament.addNewPlayer.mutationOptions({
      onMutate: async ({ player, addedAt }) => {
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

        const cache =
          queryClient.getQueryData<Array<PlayerTournamentModel>>(
            playersQueryKey,
          ) ?? [];
        const nextPlayers = cache.some((p) => p.id === newPlayer.id)
          ? cache
          : cache.concat(newPlayer);
        const context = await applyOptimisticPreStartRound(nextPlayers);
        return { ...context, newPlayer };
      },
      onError: (_err, data, context) => {
        rollbackOptimisticPreStartRound(context);
        returnToNewPlayer(data.player);
        toast.error(t('add-player-error', { player: data.player.nickname }), {
          id: `add-player-error-${data.player.id}`,
        });
      },
      onSuccess: (data) => {
        if (!isOnlyPendingPreStartRoundMutation()) return;
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
        if (!isOnlyPendingPreStartRoundMutation()) return;
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });
      },
    }),
  );
};
