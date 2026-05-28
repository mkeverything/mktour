'use server';

import { AppError } from '@/lib/errors';

import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { players } from '@/server/db/schema/players';
import {
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import type { PlayerWithUsernameModel } from '@/server/zod/players';
import { and, desc, eq, getTableColumns, notInArray } from 'drizzle-orm';

export async function getTournamentPossiblePlayers(
  tournamentId: string,
): Promise<PlayerWithUsernameModel[]> {
  const tournament = await db
    .select({ clubId: tournaments.clubId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows.at(0));

  if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');

  const tournamentPlayerRows = db
    .select({ playerId: players_to_units.playerId })
    .from(players_to_units)
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .where(eq(tournament_units.tournamentId, tournamentId));

  return await db
    .select({ ...getTableColumns(players), username: users.username })
    .from(players)
    .leftJoin(users, eq(users.id, players.userId))
    .where(
      and(
        eq(players.clubId, tournament.clubId),
        notInArray(players.id, tournamentPlayerRows),
      ),
    )
    .orderBy(desc(players.lastSeenAt));
}
