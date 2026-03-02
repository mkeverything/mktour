import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { desc, eq, getTableColumns, inArray } from 'drizzle-orm';

export async function getUserLastTournaments(userId: string, limit = 5) {
  const userPlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.userId, userId));

  if (userPlayers.length === 0) return [];

  const playerIds = userPlayers.map((p) => p.id);

  return await db
    .select({
      ...getTableColumns(players_to_tournaments),
      tournament: tournaments,
    })
    .from(players_to_tournaments)
    .innerJoin(
      tournaments,
      eq(players_to_tournaments.tournamentId, tournaments.id),
    )
    .where(inArray(players_to_tournaments.playerId, playerIds))
    .orderBy(desc(tournaments.createdAt))
    .limit(limit);
}
