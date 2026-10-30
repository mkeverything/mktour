import type { Transaction } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { asc, eq, inArray } from 'drizzle-orm';

// postgres runs transactions concurrently, so a mutation that validates state
// before writing locks the row owning that state first. when both are needed,
// lock the tournament before its club, and either before players.

/** reads the tournament and holds its row lock until the transaction ends */
export async function lockTournament(tx: Transaction, tournamentId: string) {
  return (
    await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .for('update')
  ).at(0);
}

/** serialises club-wide writes: managers, player ratings and stats ranks */
export async function lockClubs(tx: Transaction, clubIds: string[]) {
  await tx
    .select({ id: clubs.id })
    .from(clubs)
    .where(inArray(clubs.id, clubIds))
    .orderBy(asc(clubs.id))
    .for('update');
}

/**
 * reads players about to join a unit and keeps merges, which lock them for
 * update, from moving their units until the transaction ends
 */
export async function lockPlayers(tx: Transaction, playerIds: string[]) {
  return await tx
    .select()
    .from(players)
    .where(inArray(players.id, playerIds))
    .orderBy(asc(players.id))
    .for('key share');
}
