'use server';

import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';
import { and, desc, eq, lt } from 'drizzle-orm';

export const getClubTournaments = async (
  clubId: string,
  limit: number,
  cursor?: number | null,
) => {
  const result = await db
    .select()
    .from(tournaments)
    .where(
      cursor != null
        ? and(
            eq(tournaments.clubId, clubId),
            lt(tournaments.createdAt, new Date(cursor)),
          )
        : eq(tournaments.clubId, clubId),
    )
    .orderBy(desc(tournaments.createdAt))
    .limit(limit + 1);

  let nextCursor: number | null = null;
  if (result.length > limit) {
    const last = result[limit - 1];
    nextCursor = last.createdAt.getTime();
  }

  return {
    tournaments: result.slice(0, limit),
    nextCursor,
  };
};
