'use server';

import { AppError, ERRORS } from '@/lib/errors';
import { validateRequest } from '@/lib/auth/lucia';
import { createUnit, createUnitMember } from '@/lib/tournament-dashboard';
import { baselineUnitSort } from '@/lib/tournament-results';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import {
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getStatusInTournament } from '@/server/queries/get-status-in-tournament';
import { getRawTournamentUnits } from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { PlayerFormModel, PlayerInsertModel } from '@/server/zod/players';
import type { UnitModel } from '@/server/zod/tournaments';
import { and, eq } from 'drizzle-orm';
import { createPlayer } from './club-managing';
import { normalizeSwissRoundsNumberInDatabase } from './tournament-lifecycle';
import { applyPreStartUnitOrder } from './tournament-unit-order';

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
}): Promise<UnitModel[]> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new AppError(ERRORS.TOURNAMENT_NOT_FOUND);

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
): Promise<UnitModel[]> {
  const now = addedAt ?? new Date();
  const database = options.database ?? db;

  if (!options.skipAuth) {
    if (!userId) throw new AppError(ERRORS.UNAUTHENTICATED);
    const { user } = await validateRequest();
    if (!user) throw new AppError(ERRORS.UNAUTHENTICATED);
    if (user.id !== userId) throw new AppError(ERRORS.USER_MISMATCH);
    const { status } = await getStatusInTournament(user.id, tournamentId);
    if (status === 'viewer')
      throw new AppError(ERRORS.NOT_TOURNAMENT_ORGANIZER);
  }

  const tournament = await getTournamentById(tournamentId, database);
  if (!tournament) throw new AppError(ERRORS.TOURNAMENT_NOT_FOUND);
  if (tournament.startedAt)
    throw new AppError(ERRORS.TOURNAMENT_ALREADY_STARTED);
  if (tournament.type !== 'solo') {
    throw new AppError(ERRORS.NOT_SOLO_TOURNAMENT);
  }

  const unitId = requestedUnitId ?? newid();
  const unit = createUnit({
    id: unitId,
    size: 1,
    tournamentId,
    number: null,
    addedAt: now,
    nickname: player.nickname,
  });
  const playerUnit = createUnitMember({
    playerId: player.id,
    unitId: unit.id,
    numberInUnit: 1,
  });

  const run = async (d: SoloUnitDatabase) => {
    const existingMembership = await d
      .select({ id: players_to_units.id })
      .from(players_to_units)
      .innerJoin(
        tournament_units,
        eq(players_to_units.unitId, tournament_units.id),
      )
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          eq(players_to_units.playerId, player.id),
        ),
      )
      .limit(1);
    if (existingMembership.length > 0) {
      throw new AppError(ERRORS.PLAYER_ALREADY_IN_UNIT);
    }

    await d.insert(tournament_units).values(unit);
    await d.insert(players_to_units).values(playerUnit);
    await normalizeSwissRoundsNumberInDatabase(tournamentId, d);
    const currentUnits = await getRawTournamentUnits(tournamentId, d);
    return await applyPreStartUnitOrder({
      tournamentId,
      orderedUnits: currentUnits.toSorted(baselineUnitSort),
      database: d,
    });
  };

  if (options.database) return await run(options.database);
  return await db.transaction(async (tx) => run(tx));
}
