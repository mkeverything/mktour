import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { PlayerModel } from '@/server/zod/players';
import { and, desc, eq, getTableColumns, isNull } from 'drizzle-orm';

export async function getTournamentPossiblePlayers(
  id: string,
): Promise<Array<PlayerModel>> {
  const [tournament] = await db
    .select({ clubId: tournaments.clubId })
    .from(tournaments)
    .where(eq(tournaments.id, id));
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');

  const result = await db
    .select(getTableColumns(players))
    .from(players)
    .leftJoin(
      players_to_tournaments,
      and(
        eq(players.id, players_to_tournaments.playerId),
        eq(players_to_tournaments.tournamentId, id),
      ),
    )
    .where(
      and(
        eq(players.clubId, tournament.clubId),
        isNull(players_to_tournaments.playerId),
      ),
    )
    .orderBy(desc(players.lastSeenAt));

  return result as Array<PlayerModel>;
}
