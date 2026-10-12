import { CACHE_TAGS } from '@/lib/cache-tags';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { desc, eq, lt, SQL } from 'drizzle-orm';
import { cacheTag } from 'next/cache';

export default async function getAllTournamentsInfinite({
  limit = 10,
  cursor,
}: {
  limit?: number;
  cursor?: number;
} = {}) {
  'use cache';
  cacheTag(CACHE_TAGS.ALL_TOURNAMENTS);
  const query = (where?: SQL) =>
    db
      .select()
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(where)
      .orderBy(desc(tournaments.createdAt), desc(tournaments.id));

  const results = await query(
    cursor ? lt(tournaments.createdAt, new Date(cursor)) : undefined,
  ).limit(limit + 1);
  if (results.length <= limit) {
    return { tournaments: results, nextCursor: null };
  }

  // the cursor is exclusive, so a page can't end in the middle of rows sharing a createdAt
  const extra = results.pop()!;
  const lastCreatedAt = results[results.length - 1].tournament.createdAt;
  if (extra.tournament.createdAt.getTime() !== lastCreatedAt.getTime()) {
    return { tournaments: results, nextCursor: lastCreatedAt.getTime() };
  }
  const tied = await query(eq(tournaments.createdAt, lastCreatedAt));
  return {
    tournaments: [
      ...results.filter(
        ({ tournament }) => tournament.createdAt > lastCreatedAt,
      ),
      ...tied,
    ],
    nextCursor: lastCreatedAt.getTime(),
  };
}
