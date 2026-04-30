import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useOptimisticPreStartRound } from '@/components/hooks/mutation-hooks/use-optimistic-pre-start-round';
import { useTRPC } from '@/components/trpc/client';
import {
  PlayerTournamentModel,
  type PlayerWithUsernameModel,
} from '@/server/zod/players';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentAddPairTeam = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const t = useTranslations('Tournament.AddPlayer');
  const { sendJsonMessage } = useContext(DashboardContext);
  const {
    applyOptimisticPreStartRound,
    isOnlyPendingPreStartRoundMutation,
    rollbackOptimisticPreStartRound,
  } = useOptimisticPreStartRound(tournamentId);
  const playersQueryKey = trpc.tournament.playersIn.queryKey({ tournamentId });
  const playersOutQueryKey = trpc.tournament.playersOut.queryKey({
    tournamentId,
  });
  const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
    tournamentId,
    roundNumber: 1,
  });

  return useMutation(
    trpc.tournament.addPairTeam.mutationOptions({
      async onMutate({ nickname, firstPlayerId, secondPlayerId, addedAt }) {
        await queryClient.cancelQueries({ queryKey: playersOutQueryKey });

        const previousState: Array<PlayerTournamentModel> | undefined =
          queryClient.getQueryData(playersQueryKey);
        const previousPlayersOut =
          queryClient.getQueryData<Array<PlayerWithUsernameModel>>(
            playersOutQueryKey,
          );
        const nextPairingNumber = previousState?.length ?? 0;

        const nicknameLower = nickname.toLowerCase();
        const isDuplicateNickname = previousState?.some(
          (player) =>
            player.teamNickname &&
            player.teamNickname.toLowerCase() === nicknameLower,
        );

        if (isDuplicateNickname) {
          throw new Error('PAIR_NICKNAME_TAKEN');
        }

        const playersOut =
          queryClient.getQueryData<Array<PlayerWithUsernameModel>>(
            playersOutQueryKey,
          ) ?? [];

        const firstPlayer = playersOut.find(
          (player) => player.id === firstPlayerId,
        );
        const secondPlayer = playersOut.find(
          (player) => player.id === secondPlayerId,
        );

        if (!firstPlayer || !secondPlayer) {
          throw new Error('PAIR_PLAYERS_NOT_FOUND');
        }

        const teamRating = Math.round(
          (firstPlayer.rating + secondPlayer.rating) / 2,
        );

        const newPlayer: PlayerTournamentModel = {
          id: firstPlayer.id,
          nickname,
          realname: null,
          rating: teamRating,
          wins: 0,
          draws: 0,
          losses: 0,
          colorIndex: 0,
          place: null,
          isOut: null,
          pairingNumber: nextPairingNumber,
          addedAt: addedAt ?? null,
          teamNickname: nickname,
          username: null,
          pairPlayers: [
            { id: firstPlayer.id, nickname: firstPlayer.nickname },
            { id: secondPlayer.id, nickname: secondPlayer.nickname },
          ],
        };

        const nextPlayers = previousState?.some((p) => p.id === newPlayer.id)
          ? previousState
          : (previousState ?? []).concat(newPlayer);
        const context = await applyOptimisticPreStartRound(nextPlayers);

        queryClient.setQueryData(
          playersOutQueryKey,
          (cache: Array<PlayerWithUsernameModel> | undefined) =>
            cache?.filter(
              (player) =>
                player.id !== firstPlayerId && player.id !== secondPlayerId,
            ),
        );

        return { ...context, previousPlayersOut, newPlayer };
      },
      onError: (error, _data, context) => {
        rollbackOptimisticPreStartRound(context);

        if (context?.previousPlayersOut) {
          queryClient.setQueryData(
            playersOutQueryKey,
            context.previousPlayersOut,
          );
        }

        if (error.message === 'PAIR_NICKNAME_TAKEN') {
          toast.error(t('team nickname taken'));
          return;
        }
        if (error.message === 'PLAYER_ALREADY_IN_PAIR') {
          toast.error(t('player already in team'));
          return;
        }
        if (error.message === 'PAIR_PLAYERS_NOT_FOUND') {
          toast.error(t('team players not found'));
          return;
        }
        toast.error(t('team add error'));
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
        queryClient.invalidateQueries({ queryKey: playersQueryKey });
        queryClient.invalidateQueries({ queryKey: playersOutQueryKey });
        queryClient.invalidateQueries({ queryKey: roundGamesQueryKey });
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
        });
      },
    }),
  );
};
