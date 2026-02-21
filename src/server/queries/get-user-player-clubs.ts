import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { eq } from 'drizzle-orm';

export async function getUserPlayerClubs({ userId }: { userId: string }) {
  const result = await db
    .selectDistinct({
      club: clubs,
      player: players,
    })
    .from(players)
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(players.userId, userId));

  return result.map(({ club, player }) => ({
    club: {
      id: club.id,
      name: club.name,
    },
    player: {
      id: player.id,
      nickname: player.nickname,
      rating: player.rating,
    },
  }));
}
