'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { createUnit, createUnitMember } from '@/lib/tournament-dashboard';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import {
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { PlayerFormModel, PlayerInsertModel } from '@/server/zod/players';
import type { PreStartStateModel } from '@/server/zod/tournaments';
import { createPlayer } from './club-managing';
import { normalizeSwissRoundsNumberInDatabase } from './tournament-lifecycle';
import {
  getTournamentOrderTargets,
  reapplyPreStartOrder,
} from './tournament-unit-order';

type SoloUnitDatabase = Pick<
  typeof db,
  'delete' | 'insert' | 'select' | 'update'
>;

export async function addNewSoloUnit({
  tournamentId,
  player,
  unitId,
  addedAt,
}: {
  tournamentId: string;
  player: PlayerFormModel & { id?: string };
  unitId?: string;
  addedAt?: Date;
}): Promise<PreStartStateModel> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  const playerId = player.id ?? newid();
  return await db.transaction(async (tx) => {
    const createdPlayer = await createPlayer(
      { ...player, clubId: tournament.clubId },
      { database: tx, id: playerId },
    );
    return await addSoloUnit(
      { tournamentId, player: createdPlayer, unitId, addedAt },
      { database: tx, skipAuth: true },
    );
  });
}

export async function addSoloUnit(
  {
    tournamentId,
    player,
    userId,
    unitId: requestedUnitId,
    addedAt,
  }: {
    tournamentId: string;
    player: PlayerInsertModel;
    userId?: string;
    unitId?: string;
    addedAt?: Date;
  },
  options: { database?: SoloUnitDatabase; skipAuth?: boolean } = {},
): Promise<PreStartStateModel> {
  const now = addedAt ?? new Date();
  const database = options.database ?? db;

  if (!options.skipAuth) {
    if (!userId) throw new Error('UNAUTHORIZED_REQUEST');
    const { user } = await validateRequest();
    if (!user) throw new Error('UNAUTHORIZED_REQUEST');
    if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
    const { status } = await getStatusInTournament(user.id, tournamentId);
    if (status === 'viewer') throw new Error('NOT_ADMIN');
  }

  const tournament = await getTournamentById(tournamentId, database);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type !== 'solo') {
    throw new Error('NOT_SOLO_TOURNAMENT');
  }

  const nextPairingNumber = (
    await getTournamentOrderTargets(tournamentId, database)
  ).length;
  const unitId = requestedUnitId ?? newid();
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

  const run = async (d: SoloUnitDatabase) => {
    await d.insert(tournament_units).values(unit);
    await d.insert(players_to_units).values(playerUnit);
    await normalizeSwissRoundsNumberInDatabase(tournamentId, d);
    return await reapplyPreStartOrder(tournamentId, d);
  };

  if (options.database) return await run(options.database);
  return await db.transaction(async (tx) => run(tx));
}
