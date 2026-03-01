import { db } from '@/server/db';
import { affiliations } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { getUserClubIds } from '@/server/queries/get-user-clubs';
import { AffiliationStatus, StatusInClub } from '@/server/zod/enums';
import { eq } from 'drizzle-orm';
import { User } from 'lucia';
import { cacheLife, cacheTag } from 'next/cache';

const getUserInfo = async (username: string) => {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (!user) throw new Error('USER_NOT_FOUND');
  return user;
};

export const getUserInfoByUsername = async (username: string) => {
  'use cache';
  if (process.env.NODE_ENV !== 'test') {
    cacheLife({
      stale: 1000 * 60 * 60,
      revalidate: 1000 * 60 * 60,
    });
  }
  return await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
};

type UserContext = {
  user: User;
  userClubs: {
    [clubId: string]: StatusInClub; // "admin" | "co-owner"
  };
  userAffiliations: {
    [clubId: string]: {
      playerId: string;
      status: AffiliationStatus;
    };
  };
};

const getAffiliations = async (userId: string) => {
  return (
    await db
      .select({
        clubId: affiliations.clubId,
        playerId: affiliations.playerId,
        status: affiliations.status,
      })
      .from(affiliations)
      .where(eq(affiliations.userId, userId))
  ).reduce(
    (acc, curr) => {
      acc[curr.clubId] = curr;
      return acc;
    },
    {} as UserContext['userAffiliations'],
  );
};

export const getUserData = async (userId: string): Promise<UserContext> => {
  'use cache';
  const user = await getUserInfo(userId);
  const userClubs = await getUserClubIds({ userId });
  const userAffiliations = await getAffiliations(userId);
  if (process.env.NODE_ENV !== 'test') {
    cacheTag(`user-context:${userId}`);
  }
  return {
    user,
    userClubs,
    userAffiliations,
  };
};
