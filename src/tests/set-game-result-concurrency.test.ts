import { getUnitResultDeltas } from '@/lib/game-result-deltas';
import { db } from '@/server/db';
import { fixtures } from '@/server/db/seed';
import { setTournamentGameResult } from '@/server/mutations/tournament-games';
import { describe, expect, it } from 'bun:test';

describe('concurrent game result updates', () => {
  it('keeps unit statistics consistent with the final result', async () => {
    const {
      tournamentId,
      gameIds: [, gameId],
      unitIds: [, , whiteUnitId, blackUnitId],
    } = fixtures.ongoing.next().value!;

    await Promise.all([
      setTournamentGameResult({ gameId, result: '1-0' }, fixtures.organizer.id),
      setTournamentGameResult({ gameId, result: '0-1' }, fixtures.organizer.id),
    ]);

    const game = await db.query.games.findFirst({ where: { id: gameId } });
    const units = await db.query.tournament_units.findMany({
      where: { tournamentId },
    });
    const deltas = getUnitResultDeltas(null, game!.result);

    expect(units.find((unit) => unit.id === whiteUnitId)).toMatchObject(
      deltas.white,
    );
    expect(units.find((unit) => unit.id === blackUnitId)).toMatchObject(
      deltas.black,
    );
  });
});
