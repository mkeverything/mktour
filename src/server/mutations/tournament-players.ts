'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { games, players_to_tournaments } from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import {
  getTournamentById,
  compareTeamMembers,
} from '@/server/queries/tournament-helpers';
import { baselinePlayerSort } from '@/lib/tournament-results';
import {
  AddDoublesTeamModel,
  EditDoublesTeamModel,
  PlayerToTournamentInsertModel,
  ReorderTournamentPlayersInputModel,
} from '@/server/zod/tournaments';
import {
  PlayerFormModel,
  PlayerInsertModel,
  PlayerTournamentModel,
} from '@/server/zod/players';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  normalizeSwissRoundsNumber,
  normalizeSwissRoundsNumberInDatabase,
} from './tournament-lifecycle';

type TournamentParticipantOrderTarget = {
  id: string;
  teamNickname: string | null;
  numberInTeam: number | null;
  pairingNumber: number | null;
  addedAt: Date | null;
};

async function getTournamentOrderTargets(
  tournamentId: string,
  tournamentType: 'solo' | 'doubles' | 'team',
): Promise<TournamentParticipantOrderTarget[]> {
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
    for (const p of participants) {
      if (!p.teamNickname) continue;
      const existing = teams.get(p.teamNickname) ?? [];
      existing.push(p);
      teams.set(p.teamNickname, existing);
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
  tournamentType: 'solo' | 'doubles' | 'team',
  orderedTargets: TournamentParticipantOrderTarget[],
) {
  if (orderedTargets.length === 0) return;

  const queries = orderedTargets.map((target, index) => {
    const orderUpdate = {
      pairingNumber: index,
    };

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
      .set(orderUpdate)
      .where(whereClause);
  });

  const [firstQuery, ...restQueries] = queries;
  await db.batch([firstQuery, ...restQueries]);
}

async function normalizeTournamentPlayerOrder(
  tournamentId: string,
  tournamentType: 'solo' | 'doubles' | 'team',
) {
  const orderTargets = await getTournamentOrderTargets(
    tournamentId,
    tournamentType,
  );
  if (orderTargets.length === 0) return;
  await persistTournamentOrder(tournamentId, tournamentType, orderTargets);
}

export async function removePlayer({
  tournamentId,
  playerId,
  userId,
}: {
  tournamentId: string;
  playerId: string;
  userId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');

  if (tournament.type === 'doubles') {
    const participant = await db
      .select({ teamNickname: players_to_tournaments.teamNickname })
      .from(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.playerId, playerId),
        ),
      )
      .then((rows) => rows.at(0));
    if (!participant) throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');

    await db.transaction(async (tx) => {
      await tx
        .delete(games)
        .where(
          and(
            eq(games.tournamentId, tournamentId),
            or(eq(games.whiteId, playerId), eq(games.blackId, playerId)),
          ),
        );

      if (participant.teamNickname) {
        await tx
          .delete(players_to_tournaments)
          .where(
            and(
              eq(players_to_tournaments.tournamentId, tournamentId),
              eq(players_to_tournaments.teamNickname, participant.teamNickname),
            ),
          );
      } else {
        await tx
          .delete(players_to_tournaments)
          .where(
            and(
              eq(players_to_tournaments.playerId, playerId),
              eq(players_to_tournaments.tournamentId, tournamentId),
            ),
          );
      }
    });
    await normalizeTournamentPlayerOrder(tournamentId, tournament.type);
    await normalizeSwissRoundsNumber(tournamentId);
    return;
  }

  await db
    .delete(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.playerId, playerId),
        eq(players_to_tournaments.tournamentId, tournamentId),
      ),
    );
  await normalizeTournamentPlayerOrder(tournamentId, tournament.type);
  await normalizeSwissRoundsNumber(tournamentId);
}

export async function addNewPlayer({
  tournamentId,
  player,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerFormModel & { id?: string };
  addedAt?: Date;
}) {
  const now = addedAt ?? new Date();
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type === 'doubles') {
    throw new Error('DOUBLES_USE_PAIRS');
  }
  const nextPairingNumber = (
    await getTournamentOrderTargets(tournamentId, tournament.type)
  ).length;

  const playerId = player.id ?? newid();
  await db
    .insert(players)
    .values({ ...player, lastSeenAt: new Date(), id: playerId });
  const playerToTournament: PlayerToTournamentInsertModel = {
    playerId,
    tournamentId,
    id: `${playerId}=${tournamentId}`,
    wins: 0,
    losses: 0,
    draws: 0,
    colorIndex: 0,
    place: null,
    isOut: null,
    pairingNumber: nextPairingNumber,
    addedAt: now,
    newRating: null,
    newRatingDeviation: null,
    newVolatility: null,
  };
  await db.insert(players_to_tournaments).values(playerToTournament);
  await normalizeSwissRoundsNumber(tournamentId);
}

export async function reorderTournamentPlayers({
  tournamentId,
  playerIds,
}: ReorderTournamentPlayersInputModel) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');

  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status !== 'organizer') throw new Error('NOT_ADMIN');
  const orderTargets = await getTournamentOrderTargets(
    tournamentId,
    tournament.type,
  );

  if (orderTargets.length === 0) {
    throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
  }

  if (orderTargets.length !== playerIds.length) {
    throw new Error('INVALID_PLAYERS_ORDER');
  }

  const orderTargetIds = new Set(
    orderTargets.map((participant) => participant.id),
  );
  if (
    playerIds.some((playerId) => !orderTargetIds.has(playerId)) ||
    orderTargetIds.size !== playerIds.length
  ) {
    throw new Error('INVALID_PLAYERS_ORDER');
  }

  if (orderTargets.every((target, index) => target.id === playerIds[index])) {
    return;
  }

  const orderTargetsById = new Map(
    orderTargets.map((target) => [target.id, target]),
  );

  await persistTournamentOrder(
    tournamentId,
    tournament.type,
    playerIds.map((playerId) => {
      const target = orderTargetsById.get(playerId);
      if (!target) throw new Error('INVALID_PLAYERS_ORDER');
      return target;
    }),
  );
}

export async function addExistingPlayer({
  tournamentId,
  player,
  userId,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerInsertModel;
  userId: string;
  addedAt?: Date;
}) {
  const now = addedAt ?? new Date();
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type === 'doubles') {
    throw new Error('DOUBLES_USE_PAIRS');
  }
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status === 'viewer') throw new Error('NOT_ADMIN');
  const nextPairingNumber = (
    await getTournamentOrderTargets(tournamentId, tournament.type)
  ).length;

  const playerToTournament: PlayerToTournamentInsertModel = {
    playerId: player.id,
    tournamentId: tournamentId,
    id: `${player.id}=${tournamentId}`,
    wins: 0,
    losses: 0,
    draws: 0,
    colorIndex: 0,
    place: null,
    isOut: null,
    pairingNumber: nextPairingNumber,
    addedAt: now,
    newRating: null,
    newRatingDeviation: null,
    newVolatility: null,
  };
  await db.insert(players_to_tournaments).values(playerToTournament);
  await normalizeSwissRoundsNumber(tournamentId);
}

export async function addDoublesTeam({
  tournamentId,
  nickname,
  firstPlayerId,
  secondPlayerId,
  addedAt,
}: AddDoublesTeamModel & {
  tournamentId: string;
  addedAt?: Date;
}): Promise<PlayerTournamentModel> {
  const now = addedAt ?? new Date();
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  if (firstPlayerId === secondPlayerId) {
    throw new Error('INVALID_DOUBLES_PAIR');
  }

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type !== 'doubles') throw new Error('NOT_DOUBLES_TOURNAMENT');

  const selectedPlayers = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      rating: players.rating,
    })
    .from(players)
    .where(
      and(
        eq(players.clubId, tournament.clubId),
        or(eq(players.id, firstPlayerId), eq(players.id, secondPlayerId)),
      ),
    );

  if (selectedPlayers.length !== 2) {
    throw new Error('PAIR_PLAYERS_NOT_FOUND');
  }

  const existingPair = await db
    .select({ id: players_to_tournaments.id })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        or(
          eq(players_to_tournaments.playerId, firstPlayerId),
          eq(players_to_tournaments.playerId, secondPlayerId),
        ),
      ),
    )
    .limit(1);

  if (existingPair.length > 0) {
    throw new Error('PLAYER_ALREADY_IN_PAIR');
  }

  const existingNickname = await db
    .select({ id: players_to_tournaments.id })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(
          sql<string>`lower(${players_to_tournaments.teamNickname})`,
          nickname.toLowerCase(),
        ),
      ),
    )
    .limit(1);

  if (existingNickname.length > 0) {
    throw new Error('PAIR_NICKNAME_TAKEN');
  }

  const selectedPlayersById = new Map(
    selectedPlayers.map((each) => [each.id, each]),
  );
  const orderedPlayers = [firstPlayerId, secondPlayerId].map((id) => {
    const player = selectedPlayersById.get(id);
    if (!player) throw new Error('PAIR_PLAYERS_NOT_FOUND');
    return player;
  });
  const leaderPlayerId = firstPlayerId;

  const teamRating = Math.round(
    orderedPlayers.reduce((acc, player) => acc + player.rating, 0) /
      orderedPlayers.length,
  );
  const nextPairingNumber = (
    await getTournamentOrderTargets(tournamentId, tournament.type)
  ).length;

  const teamMembers: PlayerToTournamentInsertModel[] = [
    {
      playerId: firstPlayerId,
      tournamentId,
      id: `${firstPlayerId}=${tournamentId}`,
      wins: 0,
      losses: 0,
      draws: 0,
      colorIndex: 0,
      place: null,
      isOut: null,
      pairingNumber: nextPairingNumber,
      teamNickname: nickname,
      numberInTeam: 1,
      addedAt: now,
      newRating: null,
      newRatingDeviation: null,
      newVolatility: null,
    },
    {
      playerId: secondPlayerId,
      tournamentId,
      id: `${secondPlayerId}=${tournamentId}`,
      wins: 0,
      losses: 0,
      draws: 0,
      colorIndex: 0,
      place: null,
      isOut: null,
      pairingNumber: nextPairingNumber,
      teamNickname: nickname,
      numberInTeam: 2,
      addedAt: now,
      newRating: null,
      newRatingDeviation: null,
      newVolatility: null,
    },
  ];

  await db.insert(players_to_tournaments).values(teamMembers);

  await normalizeSwissRoundsNumber(tournamentId);

  return {
    id: leaderPlayerId,
    nickname,
    realname: null,
    rating: teamRating,
    wins: 0,
    draws: 0,
    losses: 0,
    colorIndex: 0,
    isOut: null,
    place: null,
    pairingNumber: nextPairingNumber,
    addedAt: now,
    teamNickname: nickname,
    username: null,
    pairPlayers: orderedPlayers.map((player) => ({
      id: player.id,
      nickname: player.nickname,
    })),
  };
}

export async function editDoublesTeam({
  tournamentId,
  currentTeamPlayerId,
  nickname,
  firstPlayerId,
  secondPlayerId,
}: EditDoublesTeamModel & {
  tournamentId: string;
}): Promise<void> {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  if (firstPlayerId === secondPlayerId) {
    throw new Error('INVALID_DOUBLES_PAIR');
  }

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type !== 'doubles') throw new Error('NOT_DOUBLES_TOURNAMENT');

  const participant = await db
    .select({
      teamNickname: players_to_tournaments.teamNickname,
      addedAt: players_to_tournaments.addedAt,
      pairingNumber: players_to_tournaments.pairingNumber,
    })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(players_to_tournaments.playerId, currentTeamPlayerId),
      ),
    )
    .then((rows) => rows.at(0));

  if (!participant?.teamNickname) {
    throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
  }
  const currentTeamNickname = participant.teamNickname;
  const preservedAddedAt = participant.addedAt ?? new Date();
  const preservedPairingNumber = participant.pairingNumber ?? 0;

  const selectedPlayers = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      rating: players.rating,
    })
    .from(players)
    .where(
      and(
        eq(players.clubId, tournament.clubId),
        or(eq(players.id, firstPlayerId), eq(players.id, secondPlayerId)),
      ),
    );

  if (selectedPlayers.length !== 2) {
    throw new Error('PAIR_PLAYERS_NOT_FOUND');
  }

  const currentTeamMembers = await db
    .select({ playerId: players_to_tournaments.playerId })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(players_to_tournaments.teamNickname, currentTeamNickname),
      ),
    );

  const currentTeamMemberIds = new Set(
    currentTeamMembers.map((member) => member.playerId),
  );

  const occupiedPlayers = await db
    .select({
      playerId: players_to_tournaments.playerId,
      teamNickname: players_to_tournaments.teamNickname,
    })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        inArray(players_to_tournaments.playerId, [
          firstPlayerId,
          secondPlayerId,
        ]),
      ),
    );

  const hasOtherTeamMember = occupiedPlayers.some(
    (row) =>
      !currentTeamMemberIds.has(row.playerId) &&
      row.teamNickname !== currentTeamNickname,
  );
  if (hasOtherTeamMember) {
    throw new Error('PLAYER_ALREADY_IN_PAIR');
  }

  const existingNickname = await db
    .select({ id: players_to_tournaments.id })
    .from(players_to_tournaments)
    .where(
      and(
        eq(players_to_tournaments.tournamentId, tournamentId),
        eq(
          sql<string>`lower(${players_to_tournaments.teamNickname})`,
          nickname.toLowerCase(),
        ),
        ne(players_to_tournaments.teamNickname, currentTeamNickname),
      ),
    )
    .limit(1);

  if (existingNickname.length > 0) {
    throw new Error('PAIR_NICKNAME_TAKEN');
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.teamNickname, currentTeamNickname),
        ),
      );

    const selectedPlayersById = new Map(
      selectedPlayers.map((each) => [each.id, each]),
    );
    const orderedPlayers = [firstPlayerId, secondPlayerId].map((id) => {
      const player = selectedPlayersById.get(id);
      if (!player) throw new Error('PAIR_PLAYERS_NOT_FOUND');
      return player;
    });

    const [firstPlayer, secondPlayer] = orderedPlayers;

    await tx.insert(players_to_tournaments).values([
      {
        playerId: firstPlayer.id,
        tournamentId,
        id: `${firstPlayer.id}=${tournamentId}`,
        wins: 0,
        losses: 0,
        draws: 0,
        colorIndex: 0,
        place: null,
        isOut: null,
        pairingNumber: preservedPairingNumber,
        teamNickname: nickname,
        numberInTeam: 1,
        addedAt: preservedAddedAt,
        newRating: null,
        newRatingDeviation: null,
        newVolatility: null,
      },
      {
        playerId: secondPlayer.id,
        tournamentId,
        id: `${secondPlayer.id}=${tournamentId}`,
        wins: 0,
        losses: 0,
        draws: 0,
        colorIndex: 0,
        place: null,
        isOut: null,
        pairingNumber: preservedPairingNumber,
        teamNickname: nickname,
        numberInTeam: 2,
        addedAt: preservedAddedAt,
        newRating: null,
        newRatingDeviation: null,
        newVolatility: null,
      },
    ]);
  });

  await normalizeSwissRoundsNumber(tournamentId);
}

export async function resetTournamentPlayers({
  tournamentId,
}: {
  tournamentId: string;
}) {
  await db.delete(games).where(eq(games.tournamentId, tournamentId));
  await db
    .delete(players_to_tournaments)
    .where(eq(players_to_tournaments.tournamentId, tournamentId));
}

export async function withdrawPlayer({
  tournamentId,
  playerId,
  userId,
}: {
  tournamentId: string;
  playerId: string;
  userId: string;
}): Promise<{
  roundsNumber: number | null;
  roundsNumberAutoDecreased: boolean;
}> {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.format !== 'swiss') throw new Error('NOT_SWISS_TOURNAMENT');
  if (!tournament.startedAt) throw new Error('TOURNAMENT_NOT_STARTED');
  if (tournament.closedAt) throw new Error('TOURNAMENT_ALREADY_FINISHED');

  const result = await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(players_to_tournaments)
      .set({ isOut: true })
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.playerId, playerId),
          or(
            isNull(players_to_tournaments.isOut),
            eq(players_to_tournaments.isOut, false),
          ),
        ),
      );

    if (!updateResult.rowsAffected) {
      const existingParticipant = await tx
        .select({ isOut: players_to_tournaments.isOut })
        .from(players_to_tournaments)
        .where(
          and(
            eq(players_to_tournaments.tournamentId, tournamentId),
            eq(players_to_tournaments.playerId, playerId),
          ),
        )
        .then((rows) => rows.at(0));

      if (existingParticipant?.isOut) {
        throw new Error('PLAYER_ALREADY_WITHDRAWN');
      }
      throw new Error('TOURNAMENT_PLAYER_NOT_FOUND');
    }

    await tx
      .delete(games)
      .where(
        and(
          eq(games.tournamentId, tournamentId),
          isNull(games.result),
          or(eq(games.whiteId, playerId), eq(games.blackId, playerId)),
        ),
      );
    const normalizedRounds = await normalizeSwissRoundsNumberInDatabase(
      tournamentId,
      tx,
    );

    return {
      roundsNumber: normalizedRounds?.roundsNumber ?? tournament.roundsNumber,
      roundsNumberAutoDecreased: normalizedRounds?.wasChanged ?? false,
    };
  });

  return result;
}
