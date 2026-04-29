'use server';

import { baselinePlayerSort } from '@/lib/tournament-results';
import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { db } from '@/server/db';
import { players_to_tournaments } from '@/server/db/schema/tournaments';
import { getTournamentPlayers } from '@/server/queries/get-tournament-players';
import {
  compareTeamMembers,
  getTournamentById,
} from '@/server/queries/tournament-helpers';
import type { TournamentType } from '@/server/zod/enums';
import type { PreStartPlayerOrderResultModel } from '@/server/zod/players';
import type { PlayerTournamentOrderModel } from '@/server/zod/tournaments';
import { and, eq } from 'drizzle-orm';
import { replaceRoundGames } from './tournament-games';

export async function getTournamentOrderTargets(
  tournamentId: string,
  tournamentType: TournamentType,
): Promise<PlayerTournamentOrderModel[]> {
  const participants = await db
    .select({
      id: players_to_tournaments.playerId,
      teamNickname: players_to_tournaments.teamNickname,
      numberInTeam: players_to_tournaments.numberInTeam,
      pairingNumber: players_to_tournaments.pairingNumber,
      addedAt: players_to_tournaments.addedAt,
    })
    .from(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, tournamentId));

  let orderTargets = participants;

  if (tournamentType === 'doubles') {
    const teams = new Map<string, typeof participants>();
    for (const participant of participants) {
      if (!participant.teamNickname) continue;
      const existing = teams.get(participant.teamNickname) ?? [];
      existing.push(participant);
      teams.set(participant.teamNickname, existing);
    }
    orderTargets = Array.from(teams.values()).map((members) => {
      members.sort((a, b) =>
        compareTeamMembers(
          { numberInTeam: a.numberInTeam, id: a.id },
          { numberInTeam: b.numberInTeam, id: b.id },
        ),
      );
      return members[0];
    });
  }

  return orderTargets.sort(baselinePlayerSort);
}

async function persistTournamentOrder(
  tournamentId: string,
  tournamentType: TournamentType,
  orderedTargets: PlayerTournamentOrderModel[],
) {
  if (orderedTargets.length === 0) return;

  const queries = orderedTargets.map((target, index) => {
    const whereClause =
      tournamentType === 'doubles' && target.teamNickname
        ? and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.teamNickname, target.teamNickname),
          )
        : and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, target.id),
          );

    return db
      .update(players_to_tournaments)
      .set({ pairingNumber: index })
      .where(whereClause);
  });

  const [firstQuery, ...restQueries] = queries;
  await db.batch([firstQuery, ...restQueries]);
}

export async function applyPreStartPlayerOrder({
  tournamentId,
  tournamentType,
  orderedTargets,
}: {
  tournamentId: string;
  tournamentType: TournamentType;
  orderedTargets: PlayerTournamentOrderModel[];
}): Promise<PreStartPlayerOrderResultModel> {
  await persistTournamentOrder(tournamentId, tournamentType, orderedTargets);

  const players = await getTournamentPlayers(tournamentId);
  const games = generatePreStartRoundGames({ players, tournamentId });
  await replaceRoundGames({ tournamentId, roundNumber: 1, newGames: games });

  return { players, games };
}

/**
 * recomputes pre-start round-1 pairings + games from the current db state.
 * call after any mutation that adds or removes pre-start participants so
 * pairing numbers stay contiguous and round-1 games stay in sync.
 */
export async function reapplyPreStartOrder(
  tournamentId: string,
): Promise<PreStartPlayerOrderResultModel> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  const orderTargets = await getTournamentOrderTargets(
    tournamentId,
    tournament.type,
  );
  return await applyPreStartPlayerOrder({
    tournamentId,
    tournamentType: tournament.type,
    orderedTargets: orderTargets,
  });
}
