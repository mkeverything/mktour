import { AppError } from '@/lib/errors';
import { db } from '@/server/db';
import { affiliations, players } from '@/server/db/schema/players';
import { openAffiliationStatusEnum } from '@/server/zod/enums';
import { and, eq, getColumns, inArray } from 'drizzle-orm';
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
      ...getColumns(affiliations),
    })
    .from(affiliations)
    .where(
      and(
        eq(affiliations.clubId, clubId),
        eq(affiliations.userId, user.id),
        inArray(affiliations.status, openAffiliationStatusEnum.options),
      ),
    )
    .innerJoin(players, eq(affiliations.playerId, players.id));

  return affiliation.at(0) ?? null;
}
