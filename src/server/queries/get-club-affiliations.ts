import { db } from '@/server/db';
import { affiliations, players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { desc, eq, getColumns } from 'drizzle-orm';

export default async function getClubAffiliations({
  clubId,
  cursor,
  limit,
}: {
  clubId: string;
  cursor: number;
  limit: number;
}) {
  const result = await db
    .select({
      ...getColumns(affiliations),
      user: users,
      player: { id: players.id, nickname: players.nickname },
    })
    .from(affiliations)
    .where(eq(affiliations.clubId, clubId))
    .innerJoin(users, eq(users.id, affiliations.userId))
    .innerJoin(players, eq(players.id, affiliations.playerId))
    .orderBy(
      desc(eq(affiliations.status, 'requested')),
      desc(affiliations.updatedAt),
    )
    .limit(limit + 1)
    .offset(cursor);

  let nextCursor: number | null = null;
  if (result.length > limit) {
    nextCursor = cursor + limit;
  }
  return {
    affiliations: result.slice(0, limit),
    nextCursor,
  };
}
