import { AppError } from '@/lib/errors';
import { db } from '@/server/db';
import { affiliations, players } from '@/server/db/schema/players';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { User } from 'lucia';

export async function getUserClubAffiliation(
  user: User | null,
  clubId: string,
) {
  if (!user) {
    throw new AppError('USER_NOT_FOUND');
  }

  const affiliation = await db
    .select({
      player: players,
      ...getTableColumns(affiliations),
    })
    .from(affiliations)
    .where(
      and(eq(affiliations.clubId, clubId), eq(affiliations.userId, user.id)),
    )
    .innerJoin(players, eq(affiliations.playerId, players.id));

  return affiliation.at(0) ?? null;
}
