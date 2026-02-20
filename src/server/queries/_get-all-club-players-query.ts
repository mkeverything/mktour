import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { PlayerModel } from '@/server/db/zod/players';
import { eq } from 'drizzle-orm';

export default async function getAllClubPlayersQuery(
  clubId: string,
): Promise<Array<PlayerModel>> {
  return await db.select().from(players).where(eq(players.clubId, clubId));
}
