import Profile from '@/app/[locale]/(routes)/user/[username]/profile';
import { getAppErrorMessage } from '@/lib/errors';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import { UserPlayerClubModel } from '@/server/zod/players';
import { TournamentModel } from '@/server/zod/tournaments';
import { UserPublicModel } from '@/server/zod/users';
import type { Metadata, ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export default async function UserPage(props: UserPageProps) {
  const [params, user] = await Promise.all([
    props.params,
    publicCaller.auth.info(),
  ]);
  let data: UserPublicModel;
  try {
    data = await publicCaller.user.infoByUsername({
      username: params.username,
    });
  } catch (e: unknown) {
    if (getAppErrorMessage(e) === 'USER_NOT_FOUND') notFound();
    throw e;
  }
  const isOwner = !!user && user.username === params.username;

  const [userPlayers, lastTournaments] = await Promise.all([
    publicCaller.user.playerClubs({ userId: data.id }),
    publicCaller.user.lastTournaments({ userId: data.id }),
  ]);
  const userWithPlayers: UserWithPlayers = {
    ...data,
    userPlayers,
    lastTournaments,
  };

  return <Profile user={userWithPlayers} isOwner={isOwner} />;
}

export async function generateMetadata(
  props: {
    params: Promise<{ username: string }>;
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations('Seo');

  let data: UserPublicModel;
  try {
    data = await publicCaller.user.infoByUsername({
      username: params.username,
    });
  } catch (e: unknown) {
    if (getAppErrorMessage(e) === 'USER_NOT_FOUND') notFound();
    throw e;
  }

  const [userPlayers, lastTournaments] = await Promise.all([
    publicCaller.user.playerClubs({ userId: data.id }),
    publicCaller.user.lastTournaments({ userId: data.id }),
  ]);

  return getPageMetadata(parent, {
    path: `/user/${params.username}`,
    title: t('user.profile.title', { username: data.username }),
    description: t('user.profile.description', {
      username: data.username,
      clubs: userPlayers.length,
      tournaments: lastTournaments.length,
    }),
  });
}

export type UserWithPlayers = UserPublicModel & {
  userPlayers: UserPlayerClubModel[];
  lastTournaments: TournamentModel[];
};

export interface UserPageProps {
  params: Promise<{ username: string }>;
}
