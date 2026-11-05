import 'server-only';

import { AppError } from '@/lib/errors';
import { createUnit } from '@/lib/tournament-dashboard';
import { baselineUnitSort } from '@/lib/tournament-results';
import { newid } from '@/lib/utils';
import { db, type Transaction } from '@/server/db';
import { lockPlayers, lockTournament } from '@/server/db/locks';
import {
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import { getRawTournamentUnits } from '@/server/queries/get-tournament-units';
import { getTournamentById } from '@/server/queries/tournament-helpers';
import type { PlayerFormModel, PlayerInsertModel } from '@/server/zod/players';
import type { UnitModel } from '@/server/zod/tournaments';
import { createPlayer } from './club-managing';
import { applyPreStartUnitOrder } from './tournament-unit-order';

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
  if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');

  const playerId = player.id ?? newid();
  return await db.transaction(async (tx) => {
    const createdPlayer = await createPlayer(
      { ...player, clubId: tournament.clubId },
      { database: tx, id: playerId },
    );
    return await addSoloUnit(
      { tournamentId, player: createdPlayer, unitId, addedAt },
      { database: tx },
    );
  });
}

export async function addSoloUnit(
  {
    tournamentId,
    player,
    unitId: requestedUnitId,
    addedAt,
  }: {
    tournamentId: string;
    player: PlayerInsertModel;
    unitId?: string;
    addedAt?: Date;
  },
  options: { database?: Transaction } = {},
): Promise<UnitModel[]> {
  const now = addedAt ?? new Date();

  const unitId = requestedUnitId ?? newid();
  const unit = createUnit({
    id: unitId,
    size: 1,
    tournamentId,
    number: null,
    addedAt: now,
    nickname: player.nickname,
  });

  const run = async (d: Transaction) => {
    const tournament = await lockTournament(d, tournamentId);
    if (!tournament) throw new AppError('TOURNAMENT_NOT_FOUND');
    if (tournament.closedAt) throw new AppError('TOURNAMENT_ALREADY_FINISHED');
    if (tournament.startedAt) throw new AppError('TOURNAMENT_ALREADY_STARTED');
    if (tournament.type !== 'solo') throw new AppError('NOT_SOLO_TOURNAMENT');
    const [lockedPlayer] = await lockPlayers(d, [player.id]);
    if (!lockedPlayer) throw new AppError('PLAYER_NOT_FOUND');
    const existingMembership = await d.query.players_to_units.findFirst({
      where: { tournamentId, playerId: player.id },
      columns: { unitId: true },
    });
    if (existingMembership) throw new AppError('PLAYER_ALREADY_IN_UNIT');

    await d.insert(tournament_units).values(unit);
    await d.insert(players_to_units).values({
      playerId: player.id,
      unitId,
      tournamentId,
      numberInUnit: 1,
    });
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
