import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { players_to_units, tournaments } from '@/server/db/schema/tournaments';
import { ClubStatsModel } from '@/server/zod/clubs';
import { count, desc, eq } from 'drizzle-orm';

export async function getClubStats(clubId: string): Promise<ClubStatsModel> {
  const [playersCountResult, tournamentsCountResult, mostActivePlayersResult] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(players)
        .where(eq(players.clubId, clubId)),

      db
        .select({ count: count() })
        .from(tournaments)
        .where(eq(tournaments.clubId, clubId)),

      db
        .select({
          id: players.id,
          nickname: players.nickname,
          rating: players.rating,
          tournamentsPlayed: count(players_to_units.id),
        })
        .from(players)
        .leftJoin(players_to_units, eq(players.id, players_to_units.playerId))
        .where(eq(players.clubId, clubId))
        .groupBy(players.id)
        .orderBy(desc(count(players_to_units.id)), desc(players.lastSeenAt))
        .limit(5),
    ]);

  return {
    playersCount: playersCountResult[0]?.count ?? 0,
    tournamentsCount: tournamentsCountResult[0]?.count ?? 0,
    mostActivePlayers: mostActivePlayersResult.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      rating: p.rating,
      tournamentsPlayed: Number(p.tournamentsPlayed) || 0,
    })),
  };
}
