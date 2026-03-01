import Dashboard from '@/app/tournaments/[id]/dashboard';
import {
  tournamentQueryClient,
  tournamentQueryPrefetch,
} from '@/app/tournaments/[id]/prefetch';
import { getEncryptedAuthSession } from '@/lib/get-encrypted-auth-session';
import { publicCaller } from '@/server/api';
import { TournamentInfoModel } from '@/server/zod/tournaments';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

export default async function TournamentPage(props: TournamentPageProps) {
  const params = await props.params;
  const session = await getEncryptedAuthSession();
  const user = await publicCaller.auth.info();
  let tournament: TournamentInfoModel;
  try {
    tournament = await publicCaller.tournament.info({
      tournamentId: params.id,
    });
    tournamentQueryPrefetch(params.id);
  } catch (e) {
    console.log(e);
    notFound();
  }

  const authStatus = await publicCaller.tournament.authStatus({
    tournamentId: params.id,
  });
  const playerId = authStatus.status === 'player' ? authStatus.playerId : null;

  return (
    <HydrationBoundary state={dehydrate(tournamentQueryClient)}>
      <Dashboard
        session={session}
        id={params.id}
        status={authStatus.status}
        playerId={playerId}
        userId={user?.id}
        currentRound={tournament.tournament.ongoingRound}
      />
    </HydrationBoundary>
  );
}

export interface TournamentPageProps {
  params: Promise<{ id: string }>;
}
