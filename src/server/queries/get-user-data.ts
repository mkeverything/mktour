import { userPublicProfileTag } from '@/lib/cache-tags';
import { db } from '@/server/db';
import { users } from '@/server/db/schema/users';
import { eq } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';

export const getUserInfoByUsername = async (username: string) => {
  'use cache';
  if (process.env.NODE_ENV !== 'test') {
    cacheLife({
      stale: 1000 * 60 * 60,
      revalidate: 1000 * 60 * 60,
    });
    cacheTag(userPublicProfileTag(username));
  }
  return await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
};
