import 'server-only';

import { AppError } from '@/lib/errors';
import { lower } from '@/lib/sql-lower';
import { createUnit } from '@/lib/tournament-dashboard';
import { baselineUnitSort } from '@/lib/tournament-results';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { lockPlayers, lockTournament } from '@/server/db/locks';
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
  ReorderTournamentUnitsInputModel,
  UnitModel,
} from '@/server/zod/tournaments';
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { applyGameResult } from './tournament-games';
import { normalizeSwissRoundsNumberInDatabase } from './tournament-lifecycle';
import { applyPreStartUnitOrder } from './tournament-unit-order';

export async function removeUnit({
  tournamentId,
  unitId,
}: {
  tournamentId: string;
  unitId: string;
}): Promise<UnitModel[]> {
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
  if (!unit) throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
  return await db.transaction(async (tx) => {
    const current = await lockTournament(tx, tournamentId);
    if (!current) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (current.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (current.startedAt) throw new AppError('TOURNAMENT_ALREADY_STARTED');
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
  return await db.transaction(async (tx) => {
    const current = await lockTournament(tx, tournamentId);
    if (!current) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (current.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (current.startedAt) throw new AppError('TOURNAMENT_ALREADY_STARTED');
    const currentUnits = await getRawTournamentUnits(tournamentId, tx);
    if (currentUnits.length !== unitIds.length) {
      throw new AppError('INVALID_UNITS_ORDER');
    }
    const unitsById = new Map(currentUnits.map((unit) => [unit.id, unit]));
    if (
      unitIds.some((unitId) => !unitsById.has(unitId)) ||
      new Set(unitIds).size !== unitIds.length
    ) {
      throw new AppError('INVALID_UNITS_ORDER');
    }
    return await applyPreStartUnitOrder({
      tournamentId,
      orderedUnits: unitIds.map((unitId) => {
        const unit = unitsById.get(unitId);
        if (!unit) throw new AppError('INVALID_UNITS_ORDER');
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
  if (firstPlayerId === secondPlayerId) {
    throw new AppError('INVALID_DOUBLES_PAIR');
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
  const unitMembers = [firstPlayerId, secondPlayerId].map((playerId, i) => ({
    playerId,
    unitId,
    tournamentId,
    numberInUnit: i + 1,
  }));

  return await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (tournament.startedAt) throw new AppError('TOURNAMENT_ALREADY_STARTED');
    if (tournament.type !== 'doubles')
      throw new AppError('NOT_DOUBLES_TOURNAMENT');

    const selectedPlayers = await lockPlayers(tx, [
      firstPlayerId,
      secondPlayerId,
    ]);
    if (
      selectedPlayers.length !== 2 ||
      selectedPlayers.some((player) => player.clubId !== tournament.clubId)
    ) {
      throw new AppError('PAIR_PLAYERS_NOT_FOUND');
    }

    const existingPair = await tx.query.players_to_units.findFirst({
      where: {
        tournamentId,
        playerId: { in: [firstPlayerId, secondPlayerId] },
      },
      columns: { unitId: true },
    });
    if (existingPair) throw new AppError('PLAYER_ALREADY_IN_PAIR');

    const existingNickname = await tx
      .select({ id: tournament_units.id })
      .from(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          eq(lower(tournament_units.nickname), nickname.toLowerCase()),
        ),
      )
      .limit(1);
    if (existingNickname.length > 0) {
      throw new AppError('UNIT_NICKNAME_TAKEN');
    }

    await tx.insert(tournament_units).values(unit);
    await tx.insert(players_to_units).values(unitMembers);
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
  if (firstPlayerId === secondPlayerId) {
    throw new AppError('INVALID_DOUBLES_PAIR');
  }
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
  if (tournament.type !== 'doubles')
    throw new AppError('NOT_DOUBLES_TOURNAMENT');
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
    throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
  }
  const preservedAddedAt = unit.addedAt ?? new Date();
  const preservedNumber = unit.number ?? 0;
  return await db.transaction(async (tx) => {
    const current = await lockTournament(tx, tournamentId);
    if (!current) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (current.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (current.startedAt) throw new AppError('TOURNAMENT_ALREADY_STARTED');
    const selectedPlayers = await lockPlayers(tx, [
      firstPlayerId,
      secondPlayerId,
    ]);
    if (
      selectedPlayers.length !== 2 ||
      selectedPlayers.some((player) => player.clubId !== current.clubId)
    ) {
      throw new AppError('PAIR_PLAYERS_NOT_FOUND');
    }
    const playerInOtherUnit = await tx.query.players_to_units.findFirst({
      where: {
        tournamentId,
        playerId: { in: [firstPlayerId, secondPlayerId] },
        unitId: { ne: unitId },
      },
      columns: { unitId: true },
    });
    if (playerInOtherUnit) throw new AppError('PLAYER_ALREADY_IN_PAIR');
    const existingNickname = await tx
      .select({ id: tournament_units.id })
      .from(tournament_units)
      .where(
        and(
          eq(tournament_units.tournamentId, tournamentId),
          eq(lower(tournament_units.nickname), nickname.toLowerCase()),
          ne(tournament_units.id, unitId),
        ),
      )
      .limit(1);
    if (existingNickname.length > 0) {
      throw new AppError('UNIT_NICKNAME_TAKEN');
    }
    await tx
      .delete(players_to_units)
      .where(eq(players_to_units.unitId, unitId));
    const selectedPlayersById = new Map(
      selectedPlayers.map((each) => [each.id, each]),
    );
    const orderedPlayers = [firstPlayerId, secondPlayerId].map((id) => {
      const player = selectedPlayersById.get(id);
      if (!player) throw new AppError('PAIR_PLAYERS_NOT_FOUND');
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
    await tx.insert(players_to_units).values(
      [firstPlayer, secondPlayer].map((player, i) => ({
        playerId: player.id,
        unitId,
        tournamentId,
        numberInUnit: i + 1,
      })),
    );
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
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (!!tournament.startedAt)
      throw new AppError('TOURNAMENT_ALREADY_STARTED');

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
}: {
  tournamentId: string;
  unitId: string;
}): Promise<{
  roundsNumber: number;
  roundsNumberAutoDecreased: boolean;
}> {
  const result = await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (tournament.format !== 'swiss')
      throw new AppError('NOT_SWISS_TOURNAMENT');
    if (!tournament.startedAt) throw new AppError('TOURNAMENT_NOT_STARTED');
    if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
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
    if (!unit) throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
    if (unit.isOut) throw new AppError('UNIT_ALREADY_WITHDRAWN');
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
    if (!updateResult.rowCount) {
      throw new AppError('TOURNAMENT_UNIT_NOT_FOUND');
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
