import { eq } from 'drizzle-orm';

import { baselineUnitSort, sortUnitsByResults } from '@/lib/tournament-results';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import type { UnitModel } from '@/server/zod/tournaments';
import { getTournamentGames } from './get-tournament-games';

export async function getRawTournamentUnits(
  id: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<Array<UnitModel>> {
  const rows = await database
    .select({
      id: tournament_units.id,
      size: tournament_units.size,
      wins: tournament_units.wins,
      losses: tournament_units.losses,
      draws: tournament_units.draws,
      colorIndex: tournament_units.colorIndex,
      place: tournament_units.place,
      isOut: tournament_units.isOut,
      number: tournament_units.number,
      addedAt: tournament_units.addedAt,
      unitNickname: tournament_units.nickname,
      playerId: players.id,
      playerNickname: players.nickname,
      playerRealname: players.realname,
      playerRating: players.rating,
      playerUserId: players.userId,
      numberInUnit: players_to_units.numberInUnit,
    })
    .from(tournament_units)
    .where(eq(tournament_units.tournamentId, id))
    .innerJoin(
      players_to_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(players, eq(players.id, players_to_units.playerId));

  const units = new Map<UnitModel['id'], UnitModel>();

  for (const row of rows.sort((a, b) => {
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    return a.numberInUnit - b.numberInUnit;
  })) {
    const {
      playerId,
      playerNickname,
      playerRealname,
      playerRating,
      playerUserId,
      numberInUnit,
      unitNickname,
      ...unitBase
    } = row;

    const unit = units.get(row.id) ?? {
      ...unitBase,
      unitNickname: unitNickname ?? playerNickname,
      players: [],
    };

    unit.players.push({
      id: playerId,
      nickname: playerNickname,
      realname: playerRealname,
      rating: playerRating,
      userId: playerUserId,
    });
    units.set(row.id, unit);
  }

  return Array.from(units.values());
}

export async function getTournamentUnits(
  id: string,
  database: Pick<typeof db, 'select'> = db,
): Promise<Array<UnitModel>> {
  const [tournament] = await database
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id));

  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  const [units, allGames] = await Promise.all([
    getRawTournamentUnits(id, database),
    tournament.startedAt
      ? getTournamentGames(id, database)
      : Promise.resolve([]),
  ]);

  if (!tournament.startedAt) {
    return units.sort(baselineUnitSort);
  }

  return sortUnitsByResults(units, tournament, allGames);
}

/** @deprecated use getRawTournamentUnits */
export const getRawTournamentPlayers = getRawTournamentUnits;

/** @deprecated use getTournamentUnits */
export const getTournamentPlayers = getTournamentUnits;
