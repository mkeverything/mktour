'use client';

import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useTournamentEditPairTeam = (tournamentId: string) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Tournament.AddPlayer');

  return useMutation(
    trpc.tournament.editPairTeam.mutationOptions({
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
      onSuccess: (_, { nickname }) => {
        toast.success(t('team added', { name: nickname }));
      },
      onSettled: () => {
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
      },
    }),
  );
};
