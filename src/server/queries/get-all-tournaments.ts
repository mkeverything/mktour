import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { desc, eq, lt } from 'drizzle-orm';

export default async function getAllTournaments({
  limit = 10,
  cursor,
}: {
  limit?: number;
  cursor?: number;
} = {}) {
  'use cache';
  const cursorDate = cursor ? new Date(cursor) : undefined;
  const results = await db
    .select()
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .where(cursorDate ? lt(tournaments.createdAt, cursorDate) : undefined)
    .orderBy(desc(tournaments.createdAt))
    .limit(limit + 1);

  let nextCursor: number | null = null;
  if (results.length > limit) {
    const nextItem = results.pop();
    nextCursor = nextItem?.tournament.createdAt.getTime() ?? null;
  }

  return {
    tournaments: results,
    nextCursor,
  };
}
