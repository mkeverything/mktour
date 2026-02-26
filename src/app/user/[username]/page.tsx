import Profile from '@/app/user/[username]/profile';
import { publicCaller } from '@/server/api';
import { UserPublicModel } from '@/server/db/zod/users';
import {
  getUserPlayerClubs,
  UserPlayerClubs,
} from '@/server/queries/get-user-player-clubs';
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

  const userPlayers = await getUserPlayerClubs({ userId: data.id });
  const userWithPlayers: UserWithPlayers = { ...data, userPlayers };

  return <Profile user={userWithPlayers} isOwner={isOwner} />;
}

export type UserWithPlayers = UserPublicModel & {
  userPlayers: UserPlayerClubs;
};

export interface TournamentPageProps {
  params: Promise<{ username: string }>;
}
