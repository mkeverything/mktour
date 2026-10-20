import 'server-only';

import { applyManualUnitOrder } from '@/lib/reorder-tournament-units';
import { SQLCaseWhen } from '@/lib/sql-case-when';
import { db, type Transaction } from '@/server/db';
import { tournament_units } from '@/server/db/schema/tournaments';
import type { UnitModel } from '@/server/zod/tournaments';
import { and, eq, inArray } from 'drizzle-orm';

async function persistTournamentOrder(
  tournamentId: string,
  orderedTargets: Pick<UnitModel, 'id'>[],
  database: Transaction,
) {
  if (orderedTargets.length === 0) return;

  const unitIds = orderedTargets.map((target) => target.id);
  const numberCase = orderedTargets
    .reduce(
      (builder, target, index) =>
        builder.when(eq(tournament_units.id, target.id), index),
      new SQLCaseWhen(),
    )
    .else(tournament_units.number);

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

export async function applyPreStartUnitOrder({
  tournamentId,
  orderedUnits,
  database,
}: {
  tournamentId: string;
  orderedUnits: UnitModel[];
  database?: Transaction;
}): Promise<UnitModel[]> {
  const run = async (d: Transaction) => {
    const units = applyManualUnitOrder(orderedUnits);
    await persistTournamentOrder(tournamentId, units, d);
    return units;
  };

  if (database) return await run(database);
  return await db.transaction(async (tx) => run(tx));
}
