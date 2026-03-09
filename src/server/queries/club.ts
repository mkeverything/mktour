import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { ClubModel } from '@/server/zod/clubs';
import { PlayerModel } from '@/server/zod/players';
import { and, desc, eq } from 'drizzle-orm';

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

export const getUserClubPlayer = async ({
  clubId,
  userId,
}: {
  clubId: string;
  userId: string;
}): Promise<PlayerModel | null> => {
  const player = await db
    .select()
    .from(players)
    .where(and(eq(players.clubId, clubId), eq(players.userId, userId)))
    .get();

  return player ?? null;
};

export const getPublicPopularClubs = async (limit: number) => {
  return await db
    .select({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      createdAt: clubs.createdAt,
      lichessTeam: clubs.lichessTeam,
      // allowPlayersSetResults: clubs.allowPlayersSetResults, // this is internal setting, why to include here?
    })
    .from(clubs)
    .leftJoin(tournamentsTable, eq(clubs.id, tournamentsTable.clubId))
    .leftJoin(players, eq(clubs.id, players.clubId))
    .groupBy(clubs.id)
    .orderBy(
      desc(countDistinct(tournamentsTable.id)),
      desc(countDistinct(players.id)),
    )
    .limit(limit);
};
