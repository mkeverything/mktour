import { db } from '@/server/db';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/db/zod/clubs';
import { TournamentModel } from '@/server/db/zod/tournaments';
import { eq, inArray } from 'drizzle-orm';

export default async function getTournamentsToUserClubsQuery({
  user,
}: Pick<UserClubsQueryProps, 'user'>) {
  // Get the club IDs the user is associated with
  const userClubs = await db
    .select()
    .from(clubs_to_users)
    .where(eq(clubs_to_users.userId, user.id));

  const clubIds = userClubs.map((club) => club.clubId);

  if (clubIds.length === 0) {
    return [];
  }

  // Get the tournaments associated with these clubs
  const tournamentsFromUserClubs = await db
    .select({
      tournament: tournaments,
      club: clubs,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .where(inArray(tournaments.clubId, clubIds));

  return tournamentsFromUserClubs as TournamentWithClubModel[];
}

interface UserClubsQueryProps {
  user: { id: string };
}

export interface TournamentWithClubModel {
  tournament: TournamentModel;
  club: ClubModel;
}
