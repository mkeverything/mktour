import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { eq, getColumns } from 'drizzle-orm';

export default async function getPlayer(playerId: string) {
  const [result] = await db
    .select({
      ...getColumns(players),
      user: getColumns(users),
      club: getColumns(clubs),
    })
    .from(players)
    .where(eq(players.id, playerId))
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .leftJoin(users, eq(players.userId, users.id));

  return result ?? null;
}
