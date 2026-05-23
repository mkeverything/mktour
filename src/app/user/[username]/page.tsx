import Profile from '@/app/user/[username]/profile';
import { BASE_URL } from '@/lib/config/urls';
import { ERRORS, getAppErrorCode } from '@/lib/errors';
import { publicCaller } from '@/server/api';
import { UserPlayerClubModel } from '@/server/zod/players';
import { TournamentModel } from '@/server/zod/tournaments';
import { UserPublicModel } from '@/server/zod/users';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
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
    if (getAppErrorCode(e) === ERRORS.USER_NOT_FOUND) notFound();
    throw e;
  }
  const isOwner = !!user && user.username === params.username;

  const userPlayers = await publicCaller.user.playerClubs({
    userId: data.id,
  });
  const lastTournaments = await publicCaller.user.lastTournaments({
    userId: data.id,
  });
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
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/user/${params.username}`;
  const previous = await parent;

  let data: UserPublicModel;
  try {
    data = await publicCaller.user.infoByUsername({
      username: params.username,
    });
  } catch (e: unknown) {
    if (getAppErrorCode(e) === ERRORS.USER_NOT_FOUND) notFound();
    throw e;
  }

  const userPlayers = await publicCaller.user.playerClubs({
    userId: data.id,
  });
  const lastTournaments = await publicCaller.user.lastTournaments({
    userId: data.id,
  });

  return {
    title: t('user.profile.title', { username: data.username }),
    description: t('user.profile.description', {
      username: data.username,
      clubs: userPlayers.length,
      tournaments: lastTournaments.length,
    }),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('user.profile.title', { username: data.username }),
      description: t('user.profile.description', {
        username: data.username,
        clubs: userPlayers.length,
        tournaments: lastTournaments.length,
      }),
      url,
    },
  };
}

export type UserWithPlayers = UserPublicModel & {
  userPlayers: UserPlayerClubModel[];
  lastTournaments: TournamentModel[];
};

export interface TournamentPageProps {
  params: Promise<{ username: string }>;
}
