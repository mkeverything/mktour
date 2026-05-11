import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/zod/clubs';
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm';

export default async function getAllClubs({
  limit = 10,
  cursor,
}: {
  limit?: number;
  cursor?: number;
} = {}) {
  const cursorDate = cursor ? new Date(cursor) : undefined;
  const whereCondition = cursorDate
    ? and(isNotNull(tournaments.closedAt), lt(clubs.createdAt, cursorDate))
    : isNotNull(tournaments.closedAt);

  const results = await db
    .selectDistinct({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      createdAt: clubs.createdAt,
      lichessTeam: clubs.lichessTeam,
      allowPlayersSetResults: clubs.allowPlayersSetResults,
    })
    .from(clubs)
    .innerJoin(tournaments, eq(clubs.id, tournaments.clubId))
    .where(whereCondition)
    .orderBy(desc(clubs.createdAt))
    .limit(limit + 1);

  let nextCursor: number | null = null;
  if (results.length > limit) {
    const nextItem = results.pop();
    nextCursor = nextItem?.createdAt.getTime() ?? null;
  }

  return {
    clubs: results as ClubModel[],
    nextCursor,
  };
}
