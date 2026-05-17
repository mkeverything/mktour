'use server';

import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { applyManualUnitOrder } from '@/lib/reorder-tournament-units';
import { SQLCaseWhen } from '@/lib/sql-case-when';
import { baselineUnitSort } from '@/lib/tournament-results';
import { db } from '@/server/db';
import {
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getRawTournamentUnits } from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { GameModel, UnitModel } from '@/server/zod/tournaments';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { replaceRoundGames } from './tournament-games';

type TournamentOrderTarget = Pick<
  UnitModel,
  'id' | 'number' | 'addedAt' | 'unitNickname' | 'players'
>;

type PreStartUnitOrderResult = {
  units: UnitModel[];
  games: GameModel[];
};

type PreStartOrderDatabase = Pick<
  typeof db,
  'select' | 'insert' | 'update' | 'delete'
>;

export async function getTournamentOrderTargets(
  tournamentId: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<TournamentOrderTarget[]> {
  const rows = await database
    .select({
      id: tournament_units.id,
      number: tournament_units.number,
      addedAt: tournament_units.addedAt,
      unitNickname: tournament_units.nickname,
      playerId: players_to_units.playerId,
      numberInUnit: players_to_units.numberInUnit,
    })
    .from(tournament_units)
    .where(eq(tournament_units.tournamentId, tournamentId))
    .innerJoin(
      players_to_units,
      eq(players_to_units.unitId, tournament_units.id),
    );

  const units = new Map<string, TournamentOrderTarget>();
  for (const row of rows.sort((a, b) => a.numberInUnit - b.numberInUnit)) {
    const unit = units.get(row.id) ?? {
      id: row.id,
      number: row.number,
      addedAt: row.addedAt,
      unitNickname: row.unitNickname ?? '',
      players: [],
    };
    unit.players.push({
      id: row.playerId,
      nickname: '',
      realname: null,
      rating: 0,
      userId: null,
      username: null,
    });
    units.set(row.id, unit);
  }

  return Array.from(units.values()).sort(baselineUnitSort);
}

async function persistTournamentOrder(
  tournamentId: string,
  orderedTargets: Pick<UnitModel, 'id'>[],
  database: Pick<typeof db, 'update'>,
) {
  if (orderedTargets.length === 0) return;

  const unitIds = orderedTargets.map((target) => target.id);
  const numberCase = orderedTargets
    .reduce(
      (builder, target, index) =>
        builder.when(eq(tournament_units.id, target.id), index),
      new SQLCaseWhen(),
    )
    .else(sql`${tournament_units.number}`);

  await database
    .update(tournament_units)
    .set({ number: numberCase })
    .where(
      and(
        eq(tournament_units.tournamentId, tournamentId),
        inArray(tournament_units.id, unitIds),
      ),
    );
}

function toGeneratorUnit(
  unit: UnitModel,
  pairingNumber: number,
): UnitModel & { nickname: string; rating: number; pairingNumber: number } {
  const firstPlayer = unit.players[0];
  return {
    ...unit,
    nickname: unit.unitNickname,
    rating: firstPlayer?.rating ?? 0,
    pairingNumber,
  };
}

function personalPlayerIdForGameSide(
  unit: UnitModel | undefined,
): null | string {
  if (!unit || unit.size !== 1) return null;
  return unit.players[0]?.id ?? null;
}

function addPersonalGameColumns(
  games: GameModel[],
  units: UnitModel[],
): GameModel[] {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  return games.map((game) => ({
    ...game,
    whitePlayerId: personalPlayerIdForGameSide(unitsById.get(game.whiteUnitId)),
    blackPlayerId: personalPlayerIdForGameSide(unitsById.get(game.blackUnitId)),
  }));
}

async function persistPreStartRound({
  tournamentId,
  orderedUnits,
  database,
}: {
  tournamentId: string;
  orderedUnits: UnitModel[];
  database: PreStartOrderDatabase;
}): Promise<PreStartUnitOrderResult> {
  const units = applyManualUnitOrder(orderedUnits);
  const generatorUnits = units.map((unit, index) =>
    toGeneratorUnit(unit, index),
  );
  const games = addPersonalGameColumns(
    generatePreStartRoundGames({
      players: generatorUnits,
      tournamentId,
    }),
    units,
  );

  await persistTournamentOrder(tournamentId, units, database);
  await replaceRoundGames({
    tournamentId,
    roundNumber: 1,
    newGames: games,
    database,
  });

  return { units, games };
}

export async function applyPreStartUnitOrder({
  tournamentId,
  orderedUnits,
  database,
  skipFinalReads = false,
}: {
  tournamentId: string;
  orderedUnits: UnitModel[];
  database?: PreStartOrderDatabase;
  skipFinalReads?: boolean;
}): Promise<PreStartUnitOrderResult> {
  const run = async (d: PreStartOrderDatabase) => {
    const result = await persistPreStartRound({
      tournamentId,
      orderedUnits,
      database: d,
    });

    if (skipFinalReads) {
      return { units: [], games: [] };
    }

    return result;
  };

  if (database) return await run(database);
  return await db.transaction(async (tx) => run(tx));
}

/**
 * recomputes pre-start round-1 pairings + games from the current db state.
 * call after any mutation that adds or removes pre-start participants so
 * pairing numbers stay contiguous and round-1 games stay in sync.
 */
export async function reapplyPreStartOrder(
  tournamentId: string,
  database?: PreStartOrderDatabase,
  options?: { skipFinalReads?: boolean },
): Promise<PreStartUnitOrderResult> {
  const d = database ?? db;
  const tournament = await getTournamentById(tournamentId, d);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  const currentUnits = await getRawTournamentUnits(tournamentId, d);
  return await applyPreStartUnitOrder({
    tournamentId,
    orderedUnits: [...currentUnits].sort(baselineUnitSort),
    database,
    skipFinalReads: options?.skipFinalReads,
  });
}
