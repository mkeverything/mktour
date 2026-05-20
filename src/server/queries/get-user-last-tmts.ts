import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { desc, eq, getTableColumns } from 'drizzle-orm';

export async function getUserLastTournaments(userId: string, limit = 5) {
  return await db
    .select({
      ...getTableColumns(tournaments),
    })
    .from(players_to_units)
    .innerJoin(players, eq(players_to_units.playerId, players.id))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .where(eq(players.userId, userId))
    .orderBy(desc(tournaments.createdAt))
    .limit(limit);
}
