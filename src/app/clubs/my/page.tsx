import Dashboard from '@/app/clubs/my/dashboard';
import { clubQueryPrefetch } from '@/app/clubs/my/prefetch';
import { HydrateClient } from '@/components/trpc/server';
import { publicCaller } from '@/server/api';
import getStatusInClub from '@/server/queries/get-status-in-club';
import { redirect } from 'next/navigation';

export default async function ClubInfo() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/clubs/my');
  clubQueryPrefetch(user.selectedClub);
  const statusInClub = await getStatusInClub({
    userId: user.id || '',
    clubId: user.selectedClub || '',
  });

  return (
    <HydrateClient>
      <Dashboard userId={user.id} statusInClub={statusInClub} />
    </HydrateClient>
  );
}
