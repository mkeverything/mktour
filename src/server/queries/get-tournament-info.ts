import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { TournamentInfoModel } from '@/server/zod/tournaments';
import { eq, getTableColumns } from 'drizzle-orm';

export async function getTournamentInfo(
  id: string,
): Promise<TournamentInfoModel> {
  const tournamentInfo = (
    await db
      .select({
        tournament: getTableColumns(tournaments),
        club: getTableColumns(clubs),
      })
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
  ).at(0);
  if (!tournamentInfo) throw new Error('TOURNAMENT NOT FOUND');
  if (!tournamentInfo.club) throw new Error('ORGANIZER CLUB NOT FOUND');
  return tournamentInfo;
}
