import { eq } from 'drizzle-orm';

import { db, type Database } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';

export async function getTournamentById(
  tournamentId: string,
  database: Database = db,
) {
  return (
    await database
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
  ).at(0);
}
