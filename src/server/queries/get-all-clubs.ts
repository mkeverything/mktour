import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/zod/clubs';
import { desc, eq, isNotNull } from 'drizzle-orm';

export default async function getAllClubs() {
  const allClubs = await db
    .selectDistinct({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      createdAt: clubs.createdAt,
      lichessTeam: clubs.lichessTeam,
      allowPlayersSetResults: clubs.allowPlayersSetResults,
    })
    .from(clubs)
    .innerJoin(tournaments, eq(clubs.id, tournaments.clubId))
    .where(isNotNull(tournaments.closedAt))
    .orderBy(desc(clubs.createdAt))
    .$dynamic();
  return allClubs as ClubModel[];
}
