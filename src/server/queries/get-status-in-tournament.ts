import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { TournamentAuthStatusModel } from '@/server/db/zod/tournaments';
import { and, eq } from 'drizzle-orm';
import { cache } from 'react';

export const getStatusInTournament = cache(
  async (
    userId: string | null,
    tournamentId: string,
  ): Promise<TournamentAuthStatusModel> => {
    if (!userId) return { status: 'viewer' };
    const clubId = (
      await db
        .select({ club: tournaments.clubId })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
    ).at(0)?.club;
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
        .select()
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.playerId, player.id),
            eq(players_to_tournaments.tournamentId, tournamentId),
          ),
        )
    ).at(0);
    if (isHere) return { status: 'player', playerId: player.id };
    else return { status: 'viewer' };
  },
);
