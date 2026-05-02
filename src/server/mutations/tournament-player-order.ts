'use server';

import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { baselinePlayerSort } from '@/lib/tournament-results';
import { db } from '@/server/db';
import { players_to_tournaments } from '@/server/db/schema/tournaments';
import { getTournamentRoundGames } from '@/server/queries/get-tournament-games';
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
  database: Pick<typeof db, 'select'> = db,
): Promise<PlayerTournamentOrderModel[]> {
  const participants = await database
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
  database: Pick<typeof db, 'update'>,
) {
  if (orderedTargets.length === 0) return;
  for (const [index, target] of orderedTargets.entries()) {
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

    await database
      .update(players_to_tournaments)
      .set({ pairingNumber: index })
      .where(whereClause);
  }
}

export async function applyPreStartPlayerOrder({
  tournamentId,
  tournamentType,
  orderedTargets,
  database,
  skipFinalReads = false,
}: {
  tournamentId: string;
  tournamentType: TournamentType;
  orderedTargets: PlayerTournamentOrderModel[];
  database?: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;
  skipFinalReads?: boolean;
}): Promise<PreStartPlayerOrderResultModel> {
  const d = database ?? db;
  const currentPlayers = await getTournamentPlayers(tournamentId, d);
  const playersById = new Map(
    currentPlayers.map((player) => [player.id, player]),
  );
  const orderedPlayers = orderedTargets
    .map((target) => playersById.get(target.id))
    .filter((player): player is (typeof currentPlayers)[number] => !!player);
  if (orderedPlayers.length !== currentPlayers.length) {
    throw new Error('INVALID_PLAYERS_ORDER');
  }
  const games = generatePreStartRoundGames({
    players: orderedPlayers,
    tournamentId,
  });

  if (database) {
    await persistTournamentOrder(
      tournamentId,
      tournamentType,
      orderedTargets,
      database,
    );
    await replaceRoundGames({
      tournamentId,
      roundNumber: 1,
      newGames: games,
      database,
    });
  } else {
    await db.transaction(async (tx) => {
      await persistTournamentOrder(
        tournamentId,
        tournamentType,
        orderedTargets,
        tx,
      );
      await replaceRoundGames({
        tournamentId,
        roundNumber: 1,
        newGames: games,
        database: tx,
      });
    });
  }

  if (skipFinalReads) {
    return { players: [], games: [] };
  }

  const players = await getTournamentPlayers(tournamentId, d);
  const persistedGames = await getTournamentRoundGames({
    tournamentId,
    roundNumber: 1,
    database: d,
  });

  return { players, games: persistedGames };
}

/**
 * recomputes pre-start round-1 pairings + games from the current db state.
 * call after any mutation that adds or removes pre-start participants so
 * pairing numbers stay contiguous and round-1 games stay in sync.
 */
export async function reapplyPreStartOrder(
  tournamentId: string,
  database?: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>,
  options?: { skipFinalReads?: boolean },
): Promise<PreStartPlayerOrderResultModel> {
  const d = database ?? db;
  const tournament = await getTournamentById(tournamentId, d);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  const orderTargets = await getTournamentOrderTargets(
    tournamentId,
    tournament.type,
    d,
  );
  return await applyPreStartPlayerOrder({
    tournamentId,
    tournamentType: tournament.type,
    orderedTargets: orderTargets,
    database,
    skipFinalReads: options?.skipFinalReads,
  });
}
