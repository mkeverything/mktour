import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTRPC } from '@/components/trpc/client';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useContext } from 'react';
import { toast } from 'sonner';

export default function useSaveRound(props: SaveRoundMutationProps) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  return useMutation(
    trpc.tournament.saveRound.mutationOptions({
      onMutate: ({ tournamentId, roundNumber, newGames }) => {
        if (props.isTournamentGoing) {
          props.setRoundInView(roundNumber);
        }
        props.queryClient.cancelQueries({
          queryKey: trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
        });
        if (props.isTournamentGoing) {
          props.queryClient.setQueryData(
            trpc.tournament.info.queryKey({ tournamentId }),
            (cache) => {
              if (!cache) return cache;
              cache.tournament.ongoingRound = roundNumber;
              return cache;
            },
          );
        }
        props.queryClient.setQueryData(
          trpc.tournament.roundGames.queryKey({ tournamentId, roundNumber }),
          () => newGames,
        );
      },
      onSuccess: (_data, { tournamentId, roundNumber, newGames }) => {
        if (props.queryClient.isMutating() === 1) {
          sendJsonMessage({
            event: 'new-round',
            roundNumber,
            newGames,
            isTournamentGoing: props.isTournamentGoing,
          });
          if (props.queryClient.isMutating() === 1) {
            props.queryClient.invalidateQueries({
              queryKey: trpc.tournament.roundGames.queryKey({
                tournamentId,
                roundNumber,
              }),
            });
            if (props.isTournamentGoing) {
              props.queryClient.invalidateQueries({
                queryKey: trpc.tournament.pathKey(),
              });
            }
          }
        }
      },
      onError: (error, { tournamentId, roundNumber }) => {
        console.error(error);
        if (props.isTournamentGoing) {
          props.setRoundInView(roundNumber - 1);
        }
        props.queryClient.setQueryData(
          trpc.tournament.info.queryKey({ tournamentId }),
          (cache) => {
            if (!cache) return cache;
            cache.tournament.ongoingRound = roundNumber - 1;
            return cache;
          },
        );
        props.queryClient.removeQueries({
          queryKey: trpc.tournament.roundGames.queryKey({
            tournamentId,
            roundNumber,
          }),
        });
        toast.error(t('server error'));
      },
    }),
  );
}
type SaveRoundMutationProps =
  | {
      queryClient: QueryClient;
      isTournamentGoing: true;
      setRoundInView: Dispatch<SetStateAction<number>>;
    }
  | {
      queryClient: QueryClient;
      isTournamentGoing: false;
    };
