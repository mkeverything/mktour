import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import { StatusInClub } from '@/server/zod/enums';
import { and, eq } from 'drizzle-orm';
import { cache } from 'react';

export async function uncachedGetStatusInClub({
  userId,
  clubId,
}: UserClubsQueryProps): Promise<StatusInClub | null> {
  return (
    (
      await db
        .select()
        .from(clubs_to_users)
        .where(
          and(
            eq(clubs_to_users.userId, userId),
            eq(clubs_to_users.clubId, clubId),
          ),
        )
    )[0]?.status ?? null
  );
}

const getStatusInClub = cache(uncachedGetStatusInClub);

export default getStatusInClub;

type UserClubsQueryProps = {
  userId: string;
  clubId: string;
};
