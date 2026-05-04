'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import { games, players_to_tournaments } from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import { GameResult } from '@/server/zod/enums';
import {
  AddDoublesTeamModel,
  EditDoublesTeamModel,
  PlayerToTournamentInsertModel,
  ReorderTournamentPlayersInputModel,
} from '@/server/zod/tournaments';
import {
  PreStartPlayerOrderResultModel,
  PlayerFormModel,
  PlayerInsertModel,
} from '@/server/zod/players';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { applyGameResult } from './tournament-games';
import {
  normalizeSwissRoundsNumber,
  normalizeSwissRoundsNumberInDatabase,
} from './tournament-lifecycle';
import {
  applyPreStartPlayerOrder,
  getTournamentOrderTargets,
  reapplyPreStartOrder,
} from './tournament-player-order';

export async function removePlayer({
  tournamentId,
  playerId,
  userId,
}: {
  tournamentId: string;
  playerId: string;
  userId: string;
}): Promise<PreStartPlayerOrderResultModel> {
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

    return await db.transaction(async (tx) => {
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
      await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
      return await reapplyPreStartOrder(tournamentId, tx);
    });
  }

  return await db.transaction(async (tx) => {
    await tx
      .delete(players_to_tournaments)
      .where(
        and(
          eq(players_to_tournaments.playerId, playerId),
          eq(players_to_tournaments.tournamentId, tournamentId),
        ),
      );
    await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
    return await reapplyPreStartOrder(tournamentId, tx);
  });
}

export async function addNewPlayer({
  tournamentId,
  player,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerFormModel & { id?: string };
  addedAt?: Date;
}): Promise<PreStartPlayerOrderResultModel> {
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
  return await reapplyPreStartOrder(tournamentId);
}

export async function reorderTournamentPlayers({
  tournamentId,
  playerIds,
}: ReorderTournamentPlayersInputModel): Promise<PreStartPlayerOrderResultModel> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT NOT FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');

  const orderTargets = await getTournamentOrderTargets(
    tournamentId,
    tournament.type,
  );

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

  const orderTargetsById = new Map(
    orderTargets.map((target) => [target.id, target]),
  );

  return await applyPreStartPlayerOrder({
    tournamentId,
    tournamentType: tournament.type,
    orderedTargets: playerIds.map((playerId) => {
      const target = orderTargetsById.get(playerId);
      if (!target) throw new Error('INVALID_PLAYERS_ORDER');
      return target;
    }),
  });
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
}): Promise<PreStartPlayerOrderResultModel> {
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
  return await reapplyPreStartOrder(tournamentId);
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
}): Promise<PreStartPlayerOrderResultModel> {
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

  return await reapplyPreStartOrder(tournamentId);
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

    const pendingGames = await tx
      .select({
        id: games.id,
        whiteId: games.whiteId,
        blackId: games.blackId,
      })
      .from(games)
      .where(
        and(
          eq(games.tournamentId, tournamentId),
          isNull(games.result),
          or(eq(games.whiteId, playerId), eq(games.blackId, playerId)),
        ),
      );

    for (const pendingGame of pendingGames) {
      const isWithdrawnWhite = pendingGame.whiteId === playerId;
      let forfeitResult: GameResult;
      if (isWithdrawnWhite) {
        forfeitResult = '0-1';
      } else {
        forfeitResult = '1-0';
      }

      await applyGameResult({
        database: tx,
        tournamentId,
        gameId: pendingGame.id,
        whiteId: pendingGame.whiteId,
        blackId: pendingGame.blackId,
        prevResult: null,
        nextResult: forfeitResult,
      });
    }

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
