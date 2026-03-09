import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { count, desc, eq, sql } from 'drizzle-orm';

const ongoingFirst = sql`CASE WHEN ${tournaments.startedAt} IS NOT NULL AND ${tournaments.closedAt} IS NULL THEN 1 ELSE 0 END`;

export async function getPublicFeaturedTournaments(limit: number) {
  return await db
    .select({
      tournament: {
        id: tournaments.id,
        title: tournaments.title,
        format: tournaments.format,
        type: tournaments.type,
        date: tournaments.date,
        rated: tournaments.rated,
      },
      club: { id: clubs.id, name: clubs.name },
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .leftJoin(
      players_to_tournaments,
      eq(players_to_tournaments.tournamentId, tournaments.id),
    )
    .groupBy(tournaments.id, clubs.id)
    .orderBy(desc(ongoingFirst), desc(count(players_to_tournaments.id)))
    .limit(limit);
}
