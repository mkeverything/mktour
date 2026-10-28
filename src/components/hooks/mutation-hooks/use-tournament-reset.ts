'use client';

import { useTournamentCache } from '@/components/hooks/mutation-hooks/tournament-cache';
import { useTRPC } from '@/components/trpc/client';
import { getAppErrorMessage } from '@/lib/errors';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export default function useTournamentReset(
  tournamentId: string,
  setRoundInView: Dispatch<SetStateAction<number>>,
) {
  const tErrors = useTranslations('Errors');
  const trpc = useTRPC();
  const { settle } = useTournamentCache(tournamentId);
  return useMutation(
    trpc.tournament.reset.mutationOptions({
      onSuccess: () => setRoundInView(1),
      onSettled: () => settle('reset'),
      onError: (error) => {
        toast.error(tErrors(getAppErrorMessage(error)));
      },
    }),
  );
}
