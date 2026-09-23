import { getUnitResultDeltas } from '@/lib/game-result-deltas';
import { db } from '@/server/db';
import { setTournamentGameResult } from '@/server/mutations/tournament-games';
import { describe, expect, it } from 'bun:test';

describe('concurrent game result updates', () => {
  it('keeps unit statistics consistent with the final result', async () => {
    const tournament = await db.query.tournaments.findFirst({
      where: { id: 'concurrent-result-tournament' },
    });
    const organizer = await db.query.clubs_to_users.findFirst({
      where: { clubId: tournament!.clubId },
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
      where: { id: 'concurrent-result-game' },
    });
    const units = await db.query.tournament_units.findMany({
      where: { tournamentId: 'concurrent-result-tournament' },
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
