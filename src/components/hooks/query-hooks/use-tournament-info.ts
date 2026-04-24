import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const useTournamentInfo = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.tournament.info.queryOptions({ tournamentId }));
};

export const useTournamentGameResultInfo = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.tournament.info.queryOptions({ tournamentId }),
    select: (data) => ({
      allowPlayersSetResults: !!data.club.allowPlayersSetResults,
      hasStarted: !!data.tournament.startedAt,
      isClosed: !!data.tournament.closedAt,
    }),
  });
};

export const useTournamentSummaryInfo = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.tournament.info.queryOptions({ tournamentId }),
    select: (data) => ({
      clubId: data.club?.id,
      clubName: data.club?.name,
      closedAt: data.tournament.closedAt,
      date: data.tournament.date,
      format: data.tournament.format,
      rated: data.tournament.rated,
      tournamentId: data.tournament.id,
      type: data.tournament.type,
    }),
  });
};

export const useTournamentScoringInfo = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.tournament.info.queryOptions({ tournamentId }),
    select: (data) => ({
      closedAt: data.tournament.closedAt,
      format: data.tournament.format,
      ongoingRound: data.tournament.ongoingRound,
      startedAt: data.tournament.startedAt,
      type: data.tournament.type,
    }),
  });
};

export const useTournamentSwissRoundsInfo = (tournamentId: string) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.tournament.info.queryOptions({ tournamentId }),
    select: (data) => ({
      closedAt: data.tournament.closedAt,
      roundsNumber: data.tournament.roundsNumber,
    }),
  });
};
