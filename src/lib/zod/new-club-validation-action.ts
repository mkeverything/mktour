'use server';

import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { ClubModel } from '@/server/db/zod/clubs';
import { eq } from 'drizzle-orm';

export async function validateLichessTeam({
  lichessTeam,
}: {
  lichessTeam?: string | null;
}): Promise<ClubModel | undefined> {
  if (!lichessTeam) return undefined;
  return await db
    .select()
    .from(clubs)
    .where(eq(clubs.lichessTeam, lichessTeam))
    .get();
}
