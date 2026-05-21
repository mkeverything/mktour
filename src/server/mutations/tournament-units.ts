'use server';
import { validateRequest } from '@/lib/auth/lucia';
import { lowerEq } from '@/lib/sql-sqlite-string';
import { createUnit, createUnitMember } from '@/lib/tournament-dashboard';
import { baselineUnitSort } from '@/lib/tournament-results';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getRawTournamentUnits } from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { GameResult } from '@/server/zod/enums';
import type {
  AddDoublesUnitModel,
  EditDoublesUnitModel,
  UnitModel,
  ReorderTournamentUnitsInputModel,
} from '@/server/zod/tournaments';
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { applyGameResult } from './tournament-games';
import { normalizeSwissRoundsNumberInDatabase } from './tournament-lifecycle';
import { applyPreStartUnitOrder } from './tournament-unit-order';

export async function removeUnit({
  tournamentId,
  unitId,
  userId,
}: {
  tournamentId: string;
  unitId: string;
  userId: string;
}): Promise<UnitModel[]> {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  const unit = await db
    .select({ id: tournament_units.id })
    .from(tournament_units)
    .where(
      and(
        eq(tournament_units.tournamentId, tournamentId),
        eq(tournament_units.id, unitId),
      ),
    )
    .then((rows) => rows.at(0));
  if (!unit) throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
  return await db.transaction(async (tx) => {
    await tx
      .delete(players_to_units)
      .where(eq(players_to_units.unitId, unitId));
    await tx
      .delete(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          eq(tournament_units.id, unitId),
        ),
      );
    await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
    const currentUnits = await getRawTournamentUnits(tournamentId, tx);
    return await applyPreStartUnitOrder({
      tournamentId,
      orderedUnits: currentUnits.toSorted(baselineUnitSort),
      database: tx,
    });
  });
}
export async function reorderTournamentUnits({
  tournamentId,
  unitIds,
}: ReorderTournamentUnitsInputModel): Promise<UnitModel[]> {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  return await db.transaction(async (tx) => {
    const currentUnits = await getRawTournamentUnits(tournamentId, tx);
    if (currentUnits.length !== unitIds.length) {
      throw new Error('INVALID_UNITS_ORDER');
    }
    const unitsById = new Map(currentUnits.map((unit) => [unit.id, unit]));
    if (
      unitIds.some((unitId) => !unitsById.has(unitId)) ||
      new Set(unitIds).size !== unitIds.length
    ) {
      throw new Error('INVALID_UNITS_ORDER');
    }
    return await applyPreStartUnitOrder({
      tournamentId,
      orderedUnits: unitIds.map((unitId) => {
        const unit = unitsById.get(unitId);
        if (!unit) throw new Error('INVALID_UNITS_ORDER');
        return unit;
      }),
      database: tx,
    });
  });
}

export async function addDoublesUnit({
  tournamentId,
  nickname,
  unitId: requestedUnitId,
  firstPlayerId,
  secondPlayerId,
  addedAt,
}: AddDoublesUnitModel & {
  tournamentId: string;
  addedAt?: Date;
}): Promise<UnitModel[]> {
  const now = addedAt ?? new Date();
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (firstPlayerId === secondPlayerId) {
    throw new Error('INVALID_DOUBLES_PAIR');
  }
  const unitId = requestedUnitId ?? newid();
  const unit = createUnit({
    id: unitId,
    size: 2,
    tournamentId,
    number: null,
    addedAt: now,
    nickname,
  });
  const unitMembers = [
    createUnitMember({ playerId: firstPlayerId, unitId, numberInUnit: 1 }),
    createUnitMember({ playerId: secondPlayerId, unitId, numberInUnit: 2 }),
  ];

  return await db.transaction(async (tx) => {
    const tournament = await getTournamentById(tournamentId, tx);
    if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
    if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
    if (tournament.type !== 'doubles')
      throw new Error('NOT_DOUBLES_TOURNAMENT');

    const selectedPlayers = await tx
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

    const existingPair = await tx
      .select({ id: players_to_units.id })
      .from(players_to_units)
      .innerJoin(
        tournament_units,
        eq(players_to_units.unitId, tournament_units.id),
      )
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          or(
            eq(players_to_units.playerId, firstPlayerId),
            eq(players_to_units.playerId, secondPlayerId),
          ),
        ),
      )
      .limit(1);
    if (existingPair.length > 0) {
      throw new Error('PLAYER_ALREADY_IN_PAIR');
    }

    const existingNickname = await tx
      .select({ id: tournament_units.id })
      .from(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          lowerEq(tournament_units.nickname, nickname),
        ),
      )
      .limit(1);
    if (existingNickname.length > 0) {
      throw new Error('UNIT_NICKNAME_TAKEN');
    }

    await tx.insert(tournament_units).values(unit);
    await tx.insert(players_to_units).values(unitMembers);
    await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
    const currentUnits = await getRawTournamentUnits(tournamentId, tx);
    return await applyPreStartUnitOrder({
      tournamentId,
      orderedUnits: currentUnits.toSorted(baselineUnitSort),
      database: tx,
    });
  });
}
export async function editDoublesUnit({
  tournamentId,
  unitId,
  nickname,
  firstPlayerId,
  secondPlayerId,
}: EditDoublesUnitModel & {
  tournamentId: string;
}): Promise<UnitModel[]> {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (firstPlayerId === secondPlayerId) {
    throw new Error('INVALID_DOUBLES_PAIR');
  }
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.startedAt) throw new Error('TOURNAMENT_ALREADY_STARTED');
  if (tournament.type !== 'doubles') throw new Error('NOT_DOUBLES_TOURNAMENT');
  const unit = await db
    .select({
      nickname: tournament_units.nickname,
      addedAt: tournament_units.addedAt,
      number: tournament_units.number,
    })
    .from(tournament_units)
    .where(
      and(
        eq(tournament_units.id, unitId),
        eq(tournament_units.tournamentId, tournamentId),
      ),
    )
    .then((rows) => rows.at(0));
  if (!unit?.nickname) {
    throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
  }
  const preservedAddedAt = unit.addedAt ?? new Date();
  const preservedNumber = unit.number ?? 0;
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
  const currentUnitMembers = await db
    .select({ playerId: players_to_units.playerId })
    .from(players_to_units)
    .where(eq(players_to_units.unitId, unitId));
  const currentUnitMemberIds = new Set(
    currentUnitMembers.map((member) => member.playerId),
  );
  const occupiedPlayers = await db
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
        eq(tournament_units.tournamentId, tournamentId),
        inArray(players_to_units.playerId, [firstPlayerId, secondPlayerId]),
      ),
    );
  const hasOtherUnitMember = occupiedPlayers.some(
    (row) => !currentUnitMemberIds.has(row.playerId) && row.unitId !== unitId,
  );
  if (hasOtherUnitMember) {
    throw new Error('PLAYER_ALREADY_IN_PAIR');
  }
  const existingNickname = await db
    .select({ id: tournament_units.id })
    .from(tournament_units)
    .where(
      and(
        eq(tournament_units.tournamentId, tournamentId),
        lowerEq(tournament_units.nickname, nickname),
        ne(tournament_units.id, unitId),
      ),
    )
    .limit(1);
  if (existingNickname.length > 0) {
    throw new Error('UNIT_NICKNAME_TAKEN');
  }
  return await db.transaction(async (tx) => {
    await tx
      .delete(players_to_units)
      .where(eq(players_to_units.unitId, unitId));
    const selectedPlayersById = new Map(
      selectedPlayers.map((each) => [each.id, each]),
    );
    const orderedPlayers = [firstPlayerId, secondPlayerId].map((id) => {
      const player = selectedPlayersById.get(id);
      if (!player) throw new Error('PAIR_PLAYERS_NOT_FOUND');
      return player;
    });
    const [firstPlayer, secondPlayer] = orderedPlayers;
    await tx
      .update(tournament_units)
      .set({
        nickname,
        size: 2,
        number: preservedNumber,
        addedAt: preservedAddedAt,
      })
      .where(eq(tournament_units.id, unitId));
    await tx.insert(players_to_units).values([
      createUnitMember({
        playerId: firstPlayer.id,
        unitId,
        numberInUnit: 1,
      }),
      createUnitMember({
        playerId: secondPlayer.id,
        unitId,
        numberInUnit: 2,
      }),
    ]);
    await normalizeSwissRoundsNumberInDatabase(tournamentId, tx);
    const currentUnits = await getRawTournamentUnits(tournamentId, tx);
    return await applyPreStartUnitOrder({
      tournamentId,
      orderedUnits: currentUnits.toSorted(baselineUnitSort),
      database: tx,
    });
  });
}
export async function resetTournamentUnits({
  tournamentId,
}: {
  tournamentId: string;
}) {
  await db.transaction(async (tx) => {
    await tx.delete(games).where(eq(games.tournamentId, tournamentId));
    const units = await tx
      .select({ id: tournament_units.id })
      .from(tournament_units)
      .where(eq(tournament_units.tournamentId, tournamentId));
    const unitIds = units.map((unit) => unit.id);
    if (unitIds.length > 0) {
      await tx
        .delete(players_to_units)
        .where(inArray(players_to_units.unitId, unitIds));
    }
    await tx
      .delete(tournament_units)
      .where(eq(tournament_units.tournamentId, tournamentId));
  });
}
export async function withdrawUnit({
  tournamentId,
  unitId,
  userId,
}: {
  tournamentId: string;
  unitId: string;
  userId: string;
}): Promise<{
  roundsNumber: number | null;
  roundsNumberAutoDecreased: boolean;
}> {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (tournament.format !== 'swiss') throw new Error('NOT_SWISS_TOURNAMENT');
  if (!tournament.startedAt) throw new Error('TOURNAMENT_NOT_STARTED');
  if (tournament.closedAt) throw new Error('TOURNAMENT_ALREADY_FINISHED');
  const result = await db.transaction(async (tx) => {
    const unit = await tx
      .select({ id: tournament_units.id, isOut: tournament_units.isOut })
      .from(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          eq(tournament_units.id, unitId),
        ),
      )
      .then((rows) => rows.at(0));
    if (!unit) throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
    if (unit.isOut) throw new Error('UNIT_ALREADY_WITHDRAWN');
    const updateResult = await tx
      .update(tournament_units)
      .set({ isOut: true })
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          eq(tournament_units.id, unitId),
          or(isNull(tournament_units.isOut), eq(tournament_units.isOut, false)),
        ),
      );
    if (!updateResult.rowsAffected) {
      throw new Error('TOURNAMENT_UNIT_NOT_FOUND');
    }
    const pendingGames = await tx
      .select({
        id: games.id,
        whiteUnitId: games.whiteUnitId,
        blackUnitId: games.blackUnitId,
      })
      .from(games)
      .where(
        and(
          eq(games.tournamentId, tournamentId),
          isNull(games.result),
          or(eq(games.whiteUnitId, unitId), eq(games.blackUnitId, unitId)),
        ),
      );
    for (const pendingGame of pendingGames) {
      const isWithdrawnUnitWhite = pendingGame.whiteUnitId === unitId;
      let forfeitResult: GameResult;
      if (isWithdrawnUnitWhite) {
        forfeitResult = '0-1';
      } else {
        forfeitResult = '1-0';
      }
      await applyGameResult({
        database: tx,
        tournamentId,
        gameId: pendingGame.id,
        whiteUnitId: pendingGame.whiteUnitId,
        blackUnitId: pendingGame.blackUnitId,
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
