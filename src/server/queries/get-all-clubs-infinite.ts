import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/zod/clubs';
import { and, desc, eq, isNotNull, lt, SQL } from 'drizzle-orm';

export default async function getAllClubsInfinite({
  limit = 10,
  cursor,
}: {
  limit?: number;
  cursor?: number;
} = {}) {
  const query = (where?: SQL) =>
    db
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
      .where(and(isNotNull(tournaments.closedAt), where))
      .orderBy(desc(clubs.createdAt), desc(clubs.id));

  const results = await query(
    cursor ? lt(clubs.createdAt, new Date(cursor)) : undefined,
  ).limit(limit + 1);
  if (results.length <= limit) {
    return { clubs: results as ClubModel[], nextCursor: null };
  }

  // the cursor is exclusive, so a page can't end in the middle of rows sharing a createdAt
  const extra = results.pop()!;
  const lastCreatedAt = results[results.length - 1].createdAt;
  if (extra.createdAt.getTime() !== lastCreatedAt.getTime()) {
    return {
      clubs: results as ClubModel[],
      nextCursor: lastCreatedAt.getTime(),
    };
  }
  const tied = await query(eq(clubs.createdAt, lastCreatedAt));
  return {
    clubs: [
      ...results.filter((club) => club.createdAt > lastCreatedAt),
      ...tied,
    ] as ClubModel[],
    nextCursor: lastCreatedAt.getTime(),
  };
}
