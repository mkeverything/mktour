import { and, eq } from 'drizzle-orm';
import { cache } from 'react';

import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { TournamentAuthStatusModel } from '@/server/zod/tournaments';

export const getStatusInTournament = cache(
  async (
    userId: string | null,
    tournamentId: string,
  ): Promise<TournamentAuthStatusModel> => {
    if (!userId) return { status: 'viewer' };
    const tournament = (
      await db
        .select({ clubId: tournaments.clubId })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
    ).at(0);
    const clubId = tournament?.clubId;
    if (!clubId) throw new Error('cannot resolve tournament organizer');

    const dbStatus = (
      await db
        .select({ status: clubs_to_users.status })
        .from(clubs_to_users)
        .where(
          and(
            eq(clubs_to_users.clubId, clubId),
            eq(clubs_to_users.userId, userId),
          ),
        )
    ).at(0)?.status;
    if (dbStatus) return { status: 'organizer' };

    // find player by userId in this club
    const player = (
      await db
        .select()
        .from(players)
        .where(and(eq(players.userId, userId), eq(players.clubId, clubId)))
    ).at(0);
    if (!player) return { status: 'viewer' };

    const isHere = (
      await db
        .select({
          playerId: players_to_units.playerId,
          unitId: players_to_units.unitId,
        })
        .from(players_to_units)
        .innerJoin(
          tournament_units,
          eq(players_to_units.unitId, tournament_units.id),
        )
        .where(
          and(
            eq(players_to_units.playerId, player.id),
            eq(tournament_units.tournamentId, tournamentId),
          ),
        )
    ).at(0);
    if (isHere)
      return {
        status: 'player',
        unitId: isHere.unitId,
      };
    else return { status: 'viewer' };
  },
);
