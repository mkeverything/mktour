'use server';

import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import { baselineUnitSort } from '@/lib/tournament-results';
import { db } from '@/server/db';
import {
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getTournamentRoundGames } from '@/server/queries/get-tournament-games';
import { getTournamentUnits } from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { TournamentType } from '@/server/zod/enums';
import type { GameModel, UnitModel } from '@/server/zod/tournaments';
import { eq } from 'drizzle-orm';
import { replaceRoundGames } from './tournament-games';

type TournamentOrderTarget = Pick<
  UnitModel,
  'id' | 'number' | 'addedAt' | 'unitNickname' | 'players'
>;

type PreStartUnitOrderResult = {
  units: UnitModel[];
  games: GameModel[];
};

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
    });
    units.set(row.id, unit);
  }

  return Array.from(units.values()).sort(baselineUnitSort);
}

async function persistTournamentOrder(
  tournamentId: string,
  tournamentType: TournamentType,
  orderedTargets: TournamentOrderTarget[],
  database: Pick<typeof db, 'update'>,
) {
  void tournamentId;
  void tournamentType;
  if (orderedTargets.length === 0) return;
  for (const [index, target] of orderedTargets.entries()) {
    await database
      .update(tournament_units)
      .set({ number: index })
      .where(eq(tournament_units.id, target.id));
  }
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

function addPersonalGameColumns(
  games: GameModel[],
  units: UnitModel[],
): GameModel[] {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  return games.map((game) => ({
    ...game,
    whitePlayerId: unitsById.get(game.whiteUnitId)?.players[0]?.id ?? null,
    blackPlayerId: unitsById.get(game.blackUnitId)?.players[0]?.id ?? null,
  }));
}

export async function applyPreStartUnitOrder({
  tournamentId,
  tournamentType,
  orderedTargets,
  database,
  skipFinalReads = false,
}: {
  tournamentId: string;
  tournamentType: TournamentType;
  orderedTargets: TournamentOrderTarget[];
  database?: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;
  skipFinalReads?: boolean;
}): Promise<PreStartUnitOrderResult> {
  const d = database ?? db;

  async function readGenerateAndPersist(
    dbLike: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>,
  ) {
    const currentUnits = await getTournamentUnits(tournamentId, dbLike);
    const unitsById = new Map(currentUnits.map((unit) => [unit.id, unit]));
    const orderedUnits = orderedTargets
      .map((target) => unitsById.get(target.id))
      .filter((unit): unit is (typeof currentUnits)[number] => !!unit);
    if (orderedUnits.length !== currentUnits.length) {
      throw new Error('INVALID_UNITS_ORDER');
    }
    const generatorUnits = orderedUnits.map((unit, index) =>
      toGeneratorUnit(unit, index),
    );
    const games = addPersonalGameColumns(
      generatePreStartRoundGames({
        players: generatorUnits,
        tournamentId,
      }),
      orderedUnits,
    );
    await persistTournamentOrder(
      tournamentId,
      tournamentType,
      orderedTargets,
      dbLike,
    );
    await replaceRoundGames({
      tournamentId,
      roundNumber: 1,
      newGames: games,
      database: dbLike,
    });
  }

  if (database) {
    await readGenerateAndPersist(database);
  } else {
    await db.transaction(async (tx) => readGenerateAndPersist(tx));
  }

  if (skipFinalReads) {
    return { units: [], games: [] };
  }

  const units = await getTournamentUnits(tournamentId, d);
  const persistedGames = await getTournamentRoundGames({
    tournamentId,
    roundNumber: 1,
    database: d,
  });

  return { units, games: persistedGames };
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
): Promise<PreStartUnitOrderResult> {
  const d = database ?? db;
  const tournament = await getTournamentById(tournamentId, d);
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  const orderTargets = await getTournamentOrderTargets(tournamentId, d);
  return await applyPreStartUnitOrder({
    tournamentId,
    tournamentType: tournament.type,
    orderedTargets: orderTargets,
    database,
    skipFinalReads: options?.skipFinalReads,
  });
}
