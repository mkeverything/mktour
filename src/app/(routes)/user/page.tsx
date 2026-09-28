import { publicCaller } from '@/server/api';
import { redirect } from 'next/navigation';

const UserPage = async () => {
  const user = await publicCaller.auth.info();
  if (!user) redirect('/sign-in?from=/user');
  redirect(`/user/${user.username}`);
};

export default UserPage;
