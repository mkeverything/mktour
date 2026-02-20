import useSaveRound from '@/components/hooks/mutation-hooks/use-tournament-save-round';
import { useTRPC } from '@/components/trpc/client';
import { generateRandomRoundGames } from '@/lib/pairing-generators/random-pairs-generator';
import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useTournamentRemovePlayer = (
  tournamentId: string,
  queryClient: QueryClient,
  sendJsonMessage: (_message: DashboardMessage) => void,
) => {
  const t = useTranslations('Errors');
  const saveRound = useSaveRound({
    queryClient,
    sendJsonMessage,
    isTournamentGoing: false,
  });
  const trpc = useTRPC();
  return useMutation(
    trpc.tournament.removePlayer.mutationOptions({
      onMutate: async ({ playerId }) => {
        await queryClient.cancelQueries({
          queryKey: [tournamentId, 'players'],
        });
        const previousState = queryClient.getQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
        );

        queryClient.setQueryData(
          trpc.tournament.playersIn.queryKey({ tournamentId }),
          (cache) => cache && cache.filter((player) => player.id !== playerId),
        );

        return { previousState };
      },
      onError: (err, { playerId }, context) => {
        if (context?.previousState) {
          queryClient.setQueryData(
            trpc.tournament.playersIn.queryKey({ tournamentId }),
            context.previousState,
          );
        }
        const player = context?.previousState?.find(
          (player) => player.id === playerId,
        );
        if (!player) {
          toast.error(
            t('internal-error', {
              error: 'player not found in context.previousState',
            }),
            {
              id: 'internal-error',
              duration: 3000,
            },
          );
          return;
        }
        console.log({ err });
        toast.error(
          t('remove-player-error', {
            player: player.nickname,
          }),
          {
            id: 'remove-player-error',
            duration: 3000,
          },
        );
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.removePlayer.mutationKey(),
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
      onSuccess: (_err, data) => {
        sendJsonMessage({ event: 'remove-player', id: data.playerId });
        if (
          queryClient.isMutating({
            mutationKey: trpc.tournament.removePlayer.mutationKey(),
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
    }),
  );
};
