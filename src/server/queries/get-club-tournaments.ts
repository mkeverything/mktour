'use server';

import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';
import { desc, eq } from 'drizzle-orm';

export const getClubTournaments = async (
  clubId: string,
  limit: number,
  cursor?: number | null,
) => {
  const result = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.clubId, clubId))
    .orderBy(
      desc(tournaments.createdAt),
      desc(tournaments.startedAt),
      desc(tournaments.closedAt),
    )
    .offset(cursor ?? 0)
    .limit(limit + 1);

  let nextCursor: number | null = null;
  if (result.length > limit) {
    const currentCursor = cursor ?? 0;
    nextCursor = currentCursor + limit;
  }

  return {
    tournaments: result.slice(0, limit),
    nextCursor,
  };
};
