import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { desc, eq } from 'drizzle-orm';

export async function getUserPlayerClubs({ userId }: { userId: string }) {
  return await db
    .selectDistinct({
      club: clubs,
      player: players,
    })
    .from(players)
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(players.userId, userId))
    .orderBy(desc(players.lastSeenAt));
}
