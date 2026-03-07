'use server';

import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';
import { desc, eq } from 'drizzle-orm';

export const getClubTournaments = async (clubId: string) => {
  return await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.clubId, clubId))
    .orderBy(desc(tournaments.createdAt));
};
