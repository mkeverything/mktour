'use client';

import { useTRPC } from '@/components/trpc/client';
import {
  type PlayerTournamentModel,
  type PlayerWithUsernameModel,
} from '@/server/zod/players';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

function getPairPlayer(
  id: string,
  playersOut: PlayerWithUsernameModel[],
  playersIn: PlayerTournamentModel[] | undefined,
  currentPairPlayers: Array<{ id: string; nickname: string }> | null,
): { id: string; nickname: string } | null {
  const fromOut = playersOut.find((p) => p.id === id);
  if (fromOut) return { id: fromOut.id, nickname: fromOut.nickname };
  const fromPair = currentPairPlayers?.find((p) => p.id === id);
  if (fromPair) return fromPair;
  const fromSolo = playersIn?.find(
    (p) => p.id === id && !p.pairPlayers?.length,
  );
  if (fromSolo) return { id: fromSolo.id, nickname: fromSolo.nickname };
  return null;
}

export const useTournamentEditPairTeam = (
  tournamentId: string,
  sendJsonMessage: (_message: DashboardMessage) => void,
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Tournament.AddPlayer');

  return useMutation(
    trpc.tournament.editPairTeam.mutationOptions({
      async onMutate({
        currentTeamPlayerId,
        nickname,
        firstPlayerId,
        secondPlayerId,
      }) {
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

        const playersOut =
          queryClient.getQueryData<Array<PlayerWithUsernameModel>>(
            trpc.tournament.playersOut.queryKey({ tournamentId }),
          ) ?? [];

        const currentTeam = previousState?.find(
          (player) => player.id === currentTeamPlayerId,
        );

        const nicknameLower = nickname.toLowerCase();
        const isDuplicateNickname = previousState?.some((player) => {
          if (!player.teamNickname) return false;
          if (player.id === currentTeamPlayerId) return false;
          return player.teamNickname.toLowerCase() === nicknameLower;
        });

        if (isDuplicateNickname) {
          throw new Error('PAIR_NICKNAME_TAKEN');
        }

        const firstPair = getPairPlayer(
          firstPlayerId,
          playersOut,
          previousState,
          currentTeam?.pairPlayers ?? null,
        );
        const secondPair = getPairPlayer(
          secondPlayerId,
          playersOut,
          previousState,
          currentTeam?.pairPlayers ?? null,
        );

        if (!firstPair || !secondPair) {
          throw new Error('PAIR_PLAYERS_NOT_FOUND');
        }

        const firstRating =
          playersOut.find((p) => p.id === firstPlayerId)?.rating ??
          previousState?.find((p) => p.id === firstPlayerId)?.rating ??
          0;
        const secondRating =
          playersOut.find((p) => p.id === secondPlayerId)?.rating ??
          previousState?.find((p) => p.id === secondPlayerId)?.rating ??
          0;
        const rating = Math.round((firstRating + secondRating) / 2);

        const oldMemberIds = (currentTeam?.pairPlayers ?? []).map((p) => p.id);
        const addedIds = [firstPlayerId, secondPlayerId].filter(
          (id) => !oldMemberIds.includes(id),
        );

        const updatedTeam: PlayerTournamentModel = {
          ...currentTeam!,
          id: firstPlayerId,
          nickname,
          teamNickname: nickname,
          rating,
          pairPlayers: [firstPair, secondPair],
        };

        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache: Array<PlayerTournamentModel> | undefined) => {
            if (!cache) return [updatedTeam];
            const replaced = cache.map((p) =>
              p.id === currentTeamPlayerId ? updatedTeam : p,
            );
            return replaced.filter(
              (p) => !(addedIds.includes(p.id) && !p.pairPlayers?.length),
            );
          },
        );

        queryClient.setQueryData(
          trpc.tournament.playersOut.queryKey({ tournamentId }),
          (cache: Array<PlayerWithUsernameModel> | undefined) =>
            cache?.filter((p) => !addedIds.includes(p.id)),
        );

        return { previousState };
      },
      onError: (error, _variables, context) => {
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
      onSuccess: (_data, variables) => {
        const players = queryClient.getQueryData<Array<PlayerTournamentModel>>(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
        );
        const updatedTeam = players?.find(
          (p) => p.id === variables.firstPlayerId,
        );
        if (updatedTeam) {
          sendJsonMessage({
            event: 'edit-team-player',
            body: updatedTeam,
            previousId: variables.currentTeamPlayerId,
          });
        }
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.editPairTeam.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.tournament.roundGames.queryKey({
              tournamentId,
              roundNumber: 1,
            }),
          });
        }
      },
    }),
  );
};
