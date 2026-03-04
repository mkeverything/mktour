import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTRPC } from '@/components/trpc/client';
import { generateRandomRoundGames } from '@/lib/pairing-generators/random-pairs-generator';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useTournamentAddPairTeam = (
  tournamentId: string,
  queryClient: QueryClient,
  sendJsonMessage: (_message: DashboardMessage) => void,
) => {
  const trpc = useTRPC();
  const t = useTranslations('Tournament.AddPlayer');
  const saveRound = useSaveRound({
    queryClient,
    sendJsonMessage,
    isTournamentGoing: false,
  });

  return useMutation(
    trpc.tournament.addPairTeam.mutationOptions({
      onSuccess: (teamPlayer) => {
        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache) => {
            if (!cache) return [teamPlayer];
            if (cache.some((player) => player.id === teamPlayer.id))
              return cache;
            return cache.concat(teamPlayer);
          },
        );

        sendJsonMessage({ event: 'add-new-player', body: teamPlayer });

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

        toast.success(t('team added', { name: teamPlayer.nickname }));
      },
      onError: (error) => {
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
