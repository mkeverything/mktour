import { emptyClubCheck } from '@/app/clubs/create/empty-club-check';
import ForwardToEmptyClub from '@/app/clubs/create/forward-to-empty-club';
import NewClubForm from '@/app/clubs/create/new-club-form';
import { getUserLichessTeams } from '@/lib/api/lichess';
import { publicCaller } from '@/server/api';
import { redirect } from 'next/navigation';

export default async function CreateClubPage() {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in');
  const club = await emptyClubCheck({ user });
  const teamsFull = await getUserLichessTeams(user.username);
  const teams = teamsFull.map((el) => ({
    label: el.name.toLowerCase(),
    value: el.id,
  }));

  return (
    <div>
      {club ? (
        <ForwardToEmptyClub club={club} />
      ) : (
        <NewClubForm user={user} teams={teams} />
      )}
    </div>
  );
}
