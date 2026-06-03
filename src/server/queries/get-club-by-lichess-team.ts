import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { ClubModel } from '@/server/zod/clubs';
import { eq } from 'drizzle-orm';

export async function getClubByLichessTeam({
  lichessTeam,
  excludeClubId,
}: {
  lichessTeam?: string | null;
  excludeClubId?: string;
}): Promise<ClubModel | undefined> {
  if (!lichessTeam) return undefined;
  const club = await db
    .select()
    .from(clubs)
    .where(eq(clubs.lichessTeam, lichessTeam))
    .get();
  return club?.id === excludeClubId ? undefined : club;
}
