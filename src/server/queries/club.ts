import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { ClubModel } from '@/server/db/zod/clubs';
import { PlayerModel } from '@/server/db/zod/players';
import { desc, eq } from 'drizzle-orm';

export const getClubInfo = async (id: ClubModel['id']) => {
  const data = (await db.select().from(clubs).where(eq(clubs.id, id)))?.at(0);
  if (!data) return null;
  return data;
};

export const getClubPlayers = async (
  clubId: PlayerModel['clubId'],
  limit: number,
  cursor?: number | null,
): Promise<{ players: PlayerModel[]; nextCursor: number | null }> => {
  const result = await db
    .select()
    .from(players)
    .where(eq(players.clubId, clubId))
    .orderBy(desc(players.lastSeenAt))
    .offset(cursor ?? 0)
    .limit(limit + 1);

  let nextCursor: number | null = null;
  if (result.length > limit) {
    const currentCursor = cursor ?? 0;
    nextCursor = currentCursor + limit;
  }

  return {
    players: result.slice(0, limit),
    nextCursor,
  };
};
