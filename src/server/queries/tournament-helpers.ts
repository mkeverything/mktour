import { eq } from 'drizzle-orm';

import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';

export async function getTournamentById(
  tournamentId: string,
  database: Pick<typeof db, 'select'> = db,
) {
  return (
    await database
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
  ).at(0);
}
