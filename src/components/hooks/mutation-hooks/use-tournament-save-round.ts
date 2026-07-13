import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { gameSchema } from '@/server/zod/tournaments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useContext } from 'react';
import { toast } from 'sonner';

export default function useSaveRound(
  tournamentId: string,
  props: SaveRoundMutationProps,
) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sendJsonMessage } = useContext(DashboardContext);
  const { settle } = useTournamentCache(tournamentId);

  return useMutation(
    trpc.tournament.saveRound.mutationOptions({
      onMutate: ({ tournamentId, roundNumber, newGames }) => {
        if (props.isTournamentGoing) {
          props.setRoundInView(roundNumber);
        }
        queryClient.cancelQueries({
          queryKey: trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
        });
        if (props.isTournamentGoing) {
          queryClient.setQueryData(
            trpc.tournament.info.queryKey({ tournamentId }),
            (cache) => {
              if (!cache) return cache;
              cache.tournament.ongoingRound = roundNumber;
              return cache;
            },
          );
        }
        const optimisticGames = gameSchema.array().safeParse(newGames);
        if (optimisticGames.success) {
          queryClient.setQueryData(
            trpc.tournament.roundGames.queryKey({ tournamentId, roundNumber }),
            optimisticGames.data,
          );
        }
      },
      onSuccess: (canonicalGames, { roundNumber, tournamentId }) => {
        queryClient.setQueryData(
          trpc.tournament.roundGames.queryKey({ tournamentId, roundNumber }),
          canonicalGames,
        );
        sendJsonMessage({
          event: 'new-round',
          roundNumber,
          newGames: canonicalGames,
          isTournamentGoing: props.isTournamentGoing,
        });
      },
      onSettled: () => settle('saveRound'),
      onError: (error, { tournamentId, roundNumber }) => {
        console.error(error);
        if (props.isTournamentGoing) {
          props.setRoundInView(roundNumber - 1);
        }
        queryClient.setQueryData(
          trpc.tournament.info.queryKey({ tournamentId }),
          (cache) => {
            if (!cache) return cache;
            cache.tournament.ongoingRound = roundNumber - 1;
            return cache;
          },
        );
        queryClient.removeQueries({
          queryKey: trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
        });
        toast.error(tErrors(getAppErrorMessage(error)));
      },
    }),
  );
}
type SaveRoundMutationProps =
  | {
      isTournamentGoing: true;
      setRoundInView: Dispatch<SetStateAction<number>>;
    }
  | {
      isTournamentGoing: false;
    };
