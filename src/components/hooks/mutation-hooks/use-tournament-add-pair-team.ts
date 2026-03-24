import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTRPC } from '@/components/trpc/client';
import { generateRandomRoundGames } from '@/lib/pairing-generators/random-pairs-generator';
import {
  PlayerTournamentModel,
  type PlayerWithUsernameModel,
} from '@/server/zod/players';
import { baselinePlayerSort } from '@/lib/tournament-results';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

export const useTournamentAddPairTeam = (tournamentId: string) => {
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const trpc = useTRPC();
  const t = useTranslations('Tournament.AddPlayer');
  const saveRound = useSaveRound({
    isTournamentGoing: false,
  });

  return useMutation(
    trpc.tournament.addPairTeam.mutationOptions({
      async onMutate({ nickname, firstPlayerId, secondPlayerId, addedAt }) {
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
        });
        await queryClient.cancelQueries({
          queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
        });

        const previousState: Array<PlayerTournamentModel> | undefined =
          queryClient.getQueryData(
            trpc.tournament.playersIn.queryKey({ tournamentId }),
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
            trpc.tournament.playersOut.queryKey({ tournamentId }),
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

        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache: Array<PlayerTournamentModel> | undefined) => {
            if (!cache) return [newPlayer];
            if (cache.some((player) => player.id === newPlayer.id))
              return cache;
            return cache.concat(newPlayer).sort(baselinePlayerSort);
          },
        );

        queryClient.setQueryData(
          trpc.tournament.playersOut.queryKey({ tournamentId }),
          (cache: Array<PlayerWithUsernameModel> | undefined) =>
            cache?.filter(
              (player) =>
                player.id !== firstPlayerId && player.id !== secondPlayerId,
            ),
        );

        return { previousState, newPlayer };
      },
      onError: (error, _data, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(
            trpc.tournament.playersIn.queryKey({ tournamentId }),
            context.previousState,
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
      onSuccess: (_result, _variables, context) => {
        if (context?.newPlayer) {
          sendJsonMessage({ event: 'add-new-player', body: context.newPlayer });
        }
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.addPairTeam.mutationKey(),
          }) === 1
        ) {
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
        }
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.addPairTeam.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
          });
        }
      },
    }),
  );
};
