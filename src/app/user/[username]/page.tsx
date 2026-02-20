import Profile from '@/app/user/[username]/profile';
import { publicCaller } from '@/server/api';
import { UserPublicModel } from '@/server/db/zod/users';
import { TRPCError } from '@trpc/server';
import { notFound } from 'next/navigation';

export default async function UserPage(props: TournamentPageProps) {
  const params = await props.params;
  const user = await publicCaller.auth.info();
  let data: UserPublicModel;
  try {
    data = await publicCaller.user.infoByUsername({
      username: params.username,
    });
  } catch (e: unknown) {
    if ((e as TRPCError).code === 'NOT_FOUND') notFound();
    throw e;
  }
  const isOwner = !!user && user.username === params.username;
  return <Profile user={data} isOwner={isOwner} />;
}
export interface TournamentPageProps {
  params: Promise<{ username: string }>;
}
