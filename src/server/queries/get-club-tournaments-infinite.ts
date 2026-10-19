'use server';

import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';
import { desc, eq } from 'drizzle-orm';

export const getClubTournamentsInfinite = async (
  clubId: string,
  limit: number,
  cursor?: number | null,
) => {
  const offset = cursor ?? 0;
  const result = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.clubId, clubId))
    .orderBy(
      desc(tournaments.date),
      desc(tournaments.createdAt),
      desc(tournaments.id),
    )
    .offset(offset)
    .limit(limit + 1);

  return {
    tournaments: result.slice(0, limit),
    nextCursor: result.length > limit ? offset + limit : null,
  };
};
