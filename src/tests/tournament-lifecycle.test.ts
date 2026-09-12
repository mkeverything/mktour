import {
  beforeAll,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from 'bun:test';
import { asc, eq } from 'drizzle-orm';

import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import { players, rating_events } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { createPlayer } from '@/server/mutations/club-managing';
import {
  deleteTournament,
  finishTournament,
  resetTournament,
} from '@/server/mutations/tournament-lifecycle';

// lifecycle mutations authenticate from request cookies; in tests we stand in
// as the seeded club organizer. module mocks stay for the rest of the run,
// which is fine: no other test relies on real request validation.
let organizerId: string;
mock.module('@/lib/auth/lucia', () => ({
  validateRequest: async () => ({
    user: { id: organizerId },
    session: { id: 'test', userId: organizerId },
  }),
}));

setDefaultTimeout(60_000);

let clubId: string;

const eventsOf = (playerId: string) =>
  db
    .select()
    .from(rating_events)
    .where(eq(rating_events.playerId, playerId))
    .orderBy(asc(rating_events.publishedAt), asc(rating_events.id));

const tournamentRow = async (tournamentId: string) =>
  (
    await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
  )[0];

/** started rated solo tournament, one round, one decided game */
async function makeRunningTournament() {
  const [a, b] = await Promise.all(
    ['a', 'b'].map((side) =>
      createPlayer({ nickname: `lc ${side} ${newid()}`, rating: 1500, clubId }),
    ),
  );
  const tournamentId = newid();
  await db.insert(tournaments).values({
    id: tournamentId,
    title: 'lifecycle test',
    format: 'round robin',
    type: 'solo',
    date: '2026-01-01',
    createdAt: new Date(),
    clubId,
    startedAt: new Date(),
    roundsNumber: 1,
    ongoingRound: 1,
    rated: true,
  });
  const [ua, ub] = [newid(), newid()];
  await db.insert(tournament_units).values([
    { id: ua, size: 1, tournamentId, nickname: a.nickname },
    { id: ub, size: 1, tournamentId, nickname: b.nickname },
  ]);
  await db.insert(players_to_units).values([
    { id: `${a.id}_${ua}`, playerId: a.id, unitId: ua, numberInUnit: 1 },
    { id: `${b.id}_${ub}`, playerId: b.id, unitId: ub, numberInUnit: 1 },
  ]);
  await db.insert(games).values({
    id: newid(),
    gameNumber: 1,
    roundNumber: 1,
    whiteUnitId: ua,
    blackUnitId: ub,
    whitePlayerId: a.id,
    blackPlayerId: b.id,
    result: '1-0',
    finishedAt: new Date(),
    tournamentId,
  });
  return { tournamentId, playerIds: [a.id, b.id] };
}

beforeAll(async () => {
  const organizer = (await db.select().from(clubs_to_users).limit(1))[0];
  organizerId = organizer.userId;
  clubId = organizer.clubId;
});

describe('finishing a tournament', () => {
  test('uses one server instant for closedAt, rating publication and lastSeenAt', async () => {
    const { tournamentId, playerIds } = await makeRunningTournament();
    const before = Date.now();

    const { closedAt } = await finishTournament({ tournamentId });

    expect(closedAt.getTime() % 1000).toBe(0);
    expect(closedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(closedAt.getTime()).toBeLessThanOrEqual(Date.now());

    const tournament = await tournamentRow(tournamentId);
    expect(tournament.closedAt?.getTime()).toBe(closedAt.getTime());

    for (const playerId of playerIds) {
      const player = (
        await db.select().from(players).where(eq(players.id, playerId))
      )[0];
      const events = await eventsOf(playerId);
      expect(player.lastSeenAt.getTime()).toBe(closedAt.getTime());
      expect(player.ratingLastUpdateAt.getTime()).toBe(closedAt.getTime());
      expect(events).toHaveLength(2);
      expect(events[1].publishedAt.getTime()).toBe(closedAt.getTime());
      expect(events[1].sourceTournamentId).toBe(tournamentId);
    }
  });

  test('is irreversible: no second finish, no reset, only deletion', async () => {
    const { tournamentId, playerIds } = await makeRunningTournament();
    await finishTournament({ tournamentId });
    const eventsBefore = await eventsOf(playerIds[0]);

    await expect(finishTournament({ tournamentId })).rejects.toMatchObject({
      message: 'TOURNAMENT_ALREADY_FINISHED',
    });
    await expect(resetTournament({ tournamentId })).rejects.toMatchObject({
      message: 'FINISHED_TOURNAMENT_IS_FINAL',
    });

    const tournament = await tournamentRow(tournamentId);
    expect(tournament.closedAt).not.toBeNull();
    expect(tournament.startedAt).not.toBeNull();
    expect(await eventsOf(playerIds[0])).toEqual(eventsBefore);

    await deleteTournament({ tournamentId });

    expect(await tournamentRow(tournamentId)).toBeUndefined();
    const eventsAfter = await eventsOf(playerIds[0]);
    expect(eventsAfter).toHaveLength(2);
    expect(eventsAfter[1]).toMatchObject({
      sourceTournamentId: null,
      rating: eventsBefore[1].rating,
      ratingDeviation: eventsBefore[1].ratingDeviation,
      publishedAt: eventsBefore[1].publishedAt,
    });
  });
});
