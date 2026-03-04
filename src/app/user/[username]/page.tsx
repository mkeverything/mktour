import Profile from '@/app/user/[username]/profile';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';
import { UserPlayerClubModel } from '@/server/zod/players';
import { PlayerToTournamentModel } from '@/server/zod/tournaments';
import { UserPublicModel } from '@/server/zod/users';
import { TRPCError } from '@trpc/server';
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
    if ((e as TRPCError).code === 'NOT_FOUND') notFound();
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
    if ((e as TRPCError).code === 'NOT_FOUND') notFound();
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
  lastTournaments: PlayerToTournamentModel[];
};

export interface TournamentPageProps {
  params: Promise<{ username: string }>;
}
