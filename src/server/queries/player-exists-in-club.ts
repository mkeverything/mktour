import { normalizePlayerNickname } from '@/lib/player-nickname';
import { lower } from '@/lib/sql-lower';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { and, eq, ne } from 'drizzle-orm';

export async function playerExistsInClub({
  nickname,
  clubId,
  excludePlayerId,
}: {
  nickname: string;
  clubId: string;
  excludePlayerId?: string;
}) {
  const normalized = normalizePlayerNickname(nickname);
  const conditions = [
    eq(lower(players.nickname), normalized.toLowerCase()),
    eq(players.clubId, clubId),
  ];
  if (excludePlayerId) {
    conditions.push(ne(players.id, excludePlayerId));
  }
  return await db
    .select({ id: players.id })
    .from(players)
    .where(and(...conditions))
    .then((rows) => rows.at(0));
}
