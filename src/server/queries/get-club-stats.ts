import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubStatsModel } from '@/server/zod/clubs';
import { count, eq } from 'drizzle-orm';

export async function getClubStats(clubId: string): Promise<ClubStatsModel> {
  const [playersCountResult, tournamentsCountResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(players)
      .where(eq(players.clubId, clubId)),

    db
      .select({ count: count() })
      .from(tournaments)
      .where(eq(tournaments.clubId, clubId)),
  ]);

  return {
    playersCount: playersCountResult[0]?.count ?? 0,
    tournamentsCount: tournamentsCountResult[0]?.count ?? 0,
  };
}
