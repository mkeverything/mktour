import ClubPage from '@/app/clubs/[id]/club';
import Loading from '@/app/loading';
import { validateRequest } from '@/lib/auth/lucia';
import { publicCaller } from '@/server/api';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

export default async function Page(props: ClubPageProps) {
  const params = await props.params;
  const club = await publicCaller.club.info({ clubId: params.id });
  const { user } = await validateRequest();
  const statusInClub = await publicCaller.club.authStatus({
    clubId: params.id,
  });

  if (!club) notFound();
  return (
    <Suspense fallback={<Loading />}>
      <ClubPage
        club={club}
        statusInClub={statusInClub}
        userId={user?.id || ''}
      />
    </Suspense>
  );
}

export interface ClubPageProps {
  params: Promise<{ id: string }>;
}
