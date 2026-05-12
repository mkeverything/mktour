'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { normalizePlayerNickname } from '@/lib/player-nickname';
import { createUnit, createUnitMember } from '@/lib/tournament-dashboard';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { playerExistsInClub } from '@/server/queries/player-exists-in-club';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { PlayerFormModel, PlayerInsertModel } from '@/server/zod/players';
import type {
  PlayerUnitInsertModel,
  PreStartStateModel,
  UnitInsertModel,
} from '@/server/zod/tournaments';
import { TRPCError } from '@trpc/server';
import { normalizeSwissRoundsNumberInDatabase } from './tournament-lifecycle';
import {
  getTournamentOrderTargets,
  reapplyPreStartOrder,
} from './tournament-unit-order';

export async function addNewPlayer({
  tournamentId,
  player,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerFormModel & { id?: string };
  addedAt?: Date;
}): Promise<PreStartStateModel> {
  const now = addedAt ?? new Date();
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type === 'doubles') {
    throw new Error('DOUBLES_USE_PAIRS');
  }
  const nextPairingNumber = (await getTournamentOrderTargets(tournamentId))
    .length;

  const playerId = player.id ?? newid();
  const nickname = normalizePlayerNickname(player.nickname);
  const taken = await playerExistsInClub({
    nickname,
    clubId: tournament.clubId,
  });
  if (taken) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'player exists error',
    });
  }

  const unitId = `${playerId}_${tournamentId}`;
  const unit: UnitInsertModel = {
    id: unitId,
    size: 1,
    tournamentId,
    wins: 0,
    losses: 0,
    draws: 0,
    colorIndex: 0,
    place: null,
    isOut: null,
    number: nextPairingNumber,
    addedAt: now,
    nickname,
  };

  const playerUnit: PlayerUnitInsertModel = {
    id: `${playerId}_${unit.id}`,
    playerId,
    unitId: unit.id,
    numberInUnit: 1,
    newRating: null,
    newRatingDeviation: null,
    newVolatility: null,
  };

  return await db.transaction(async (tx) => {
    await tx
      .insert(players)
      .values({ ...player, nickname, lastSeenAt: new Date(), id: playerId });
    await tx.insert(tournament_units).values(unit);
    await tx.insert(players_to_units).values(playerUnit);
    await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
    return await reapplyPreStartOrder(tournamentId, tx);
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
}): Promise<PreStartStateModel> {
  const now = addedAt ?? new Date();
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type === 'doubles') {
    throw new Error('DOUBLES_USE_PAIRS');
  }
  const { status } = await getStatusInTournament(user.id, tournamentId);
  if (status === 'viewer') throw new Error('NOT_ADMIN');
  const nextPairingNumber = (await getTournamentOrderTargets(tournamentId))
    .length;
  const unitId = `${player.id}_${tournamentId}`;
  const unit = createUnit({
    id: unitId,
    size: 1,
    tournamentId,
    number: nextPairingNumber,
    addedAt: now,
    nickname: player.nickname,
  });
  const playerUnit = createUnitMember({
    playerId: player.id,
    unitId: unit.id,
    numberInUnit: 1,
  });
  return await db.transaction(async (tx) => {
    await tx.insert(tournament_units).values(unit);
    await tx.insert(players_to_units).values(playerUnit);
    await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
    return await reapplyPreStartOrder(tournamentId, tx);
  });
}
