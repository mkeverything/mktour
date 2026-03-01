import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { and, eq, sql } from 'drizzle-orm';

export async function playerExistsInClub({
  nickname,
  clubId,
}: {
  nickname: string;
  clubId: string;
}) {
  return await db
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        sql`lower(${players.nickname}) = ${nickname.toLowerCase()}`,
        eq(players.clubId, clubId),
      ),
    )
    .get();
}
