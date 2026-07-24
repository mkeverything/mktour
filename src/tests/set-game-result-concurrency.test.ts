import { getUnitResultDeltas } from '@/lib/game-result-deltas';
import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import {
  games,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { setTournamentGameResult } from '@/server/mutations/tournament-games';
import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';

describe('concurrent game result updates', () => {
  it('keeps unit statistics consistent with the final result', async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, 'concurrent-result-tournament'),
    });
    const organizer = await db.query.clubs_to_users.findFirst({
      where: eq(clubs_to_users.clubId, tournament!.clubId),
    });

    await Promise.all([
      setTournamentGameResult(
        { gameId: 'concurrent-result-game', result: '1-0' },
        organizer!.userId,
      ),
      setTournamentGameResult(
        { gameId: 'concurrent-result-game', result: '0-1' },
        organizer!.userId,
      ),
    ]);

    const game = await db.query.games.findFirst({
      where: eq(games.id, 'concurrent-result-game'),
    });
    const units = await db.query.tournament_units.findMany({
      where: eq(tournament_units.tournamentId, 'concurrent-result-tournament'),
    });
    const deltas = getUnitResultDeltas(null, game!.result);

    expect(
      units.find((unit) => unit.id === 'concurrent-result-white-unit'),
    ).toMatchObject(deltas.white);
    expect(
      units.find((unit) => unit.id === 'concurrent-result-black-unit'),
    ).toMatchObject(deltas.black);
  });
});
