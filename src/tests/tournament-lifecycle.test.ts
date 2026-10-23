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
  startTournament,
  updateSwissRoundsNumber,
} from '@/server/mutations/tournament-lifecycle';
import { setTournamentGameResult } from '@/server/mutations/tournament-games';
import {
  removeUnit,
  reorderTournamentUnits,
  resetTournamentUnits,
} from '@/server/mutations/tournament-units';

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
  const a = await createPlayer({
    nickname: `lc a ${newid()}`,
    rating: 1500,
    clubId,
  });
  const b = await createPlayer({
    nickname: `lc b ${newid()}`,
    rating: 1500,
    clubId,
  });
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
  test('requires a start and all persisted games to be decided', async () => {
    const { tournamentId } = await makeRunningTournament();
    await db
      .update(tournaments)
      .set({ startedAt: null })
      .where(eq(tournaments.id, tournamentId));
    await expect(finishTournament({ tournamentId })).rejects.toMatchObject({
      message: 'TOURNAMENT_NOT_STARTED',
    });
    await db
      .update(tournaments)
      .set({ startedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
    await db
      .update(games)
      .set({ result: null })
      .where(eq(games.tournamentId, tournamentId));
    await expect(finishTournament({ tournamentId })).rejects.toMatchObject({
      message: 'INCOMPLETE_GAMES',
    });
    expect((await tournamentRow(tournamentId)).closedAt).toBeNull();
  });

  test('requires the configured final round; shortening a swiss is explicit', async () => {
    const { tournamentId } = await makeRunningTournament();
    await db
      .update(tournaments)
      .set({ format: 'swiss', roundsNumber: 2 })
      .where(eq(tournaments.id, tournamentId));
    await expect(finishTournament({ tournamentId })).rejects.toMatchObject({
      message: 'TOURNAMENT_NOT_COMPLETED',
    });
    await updateSwissRoundsNumber({ tournamentId, roundsNumber: 1 });
    await finishTournament({ tournamentId });
    expect((await tournamentRow(tournamentId)).closedAt).not.toBeNull();
  });

  test('cannot start or reset units on a closed legacy pre-start tournament', async () => {
    const { tournamentId } = await makeRunningTournament();
    await db
      .update(tournaments)
      .set({ startedAt: null, closedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
    await expect(
      startTournament({
        tournamentId,
        startedAt: new Date(),
        format: 'round robin',
        roundsNumber: 1,
      }),
    ).rejects.toMatchObject({ message: 'TOURNAMENT_ALREADY_FINISHED' });
    await expect(resetTournamentUnits({ tournamentId })).rejects.toMatchObject({
      message: 'TOURNAMENT_ALREADY_FINISHED',
    });
  });

  test('transactional checks block removing and reordering started or finished units', async () => {
    const { tournamentId } = await makeRunningTournament();
    const units = await db
      .select()
      .from(tournament_units)
      .where(eq(tournament_units.tournamentId, tournamentId));
    const unitIds = units.map((unit) => unit.id);

    for (const closedAt of [null, new Date()]) {
      await db
        .update(tournaments)
        .set({ closedAt })
        .where(eq(tournaments.id, tournamentId));
      const message = closedAt
        ? 'TOURNAMENT_ALREADY_FINISHED'
        : 'TOURNAMENT_ALREADY_STARTED';
      await expect(
        removeUnit({ tournamentId, unitId: unitIds[0], userId: organizerId }),
      ).rejects.toMatchObject({ message });
      await expect(
        reorderTournamentUnits({ tournamentId, unitIds }),
      ).rejects.toMatchObject({ message });
      expect(
        await db
          .select()
          .from(tournament_units)
          .where(eq(tournament_units.tournamentId, tournamentId)),
      ).toEqual(units);
    }
  });

  test('rejects a result request paused before its transaction when closure wins', async () => {
    const { tournamentId, playerIds } = await makeRunningTournament();
    const game = (
      await db.select().from(games).where(eq(games.tournamentId, tournamentId))
    )[0];
    const reached = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const original = db.transaction.bind(db);
    let pauseNext = true;
    db.transaction = (async (...args: Parameters<typeof db.transaction>) => {
      if (pauseNext) {
        pauseNext = false;
        reached.resolve();
        await resume.promise;
      }
      return original(...args);
    }) as typeof db.transaction;
    const pending = setTournamentGameResult(
      { gameId: game.id, result: '0-1' },
      organizerId,
    );
    try {
      await reached.promise;
      await finishTournament({ tournamentId });
      const published = await eventsOf(playerIds[0]);
      resume.resolve();
      await expect(pending).rejects.toMatchObject({
        message: 'TOURNAMENT_ALREADY_FINISHED',
      });
      expect(
        (await db.select().from(games).where(eq(games.id, game.id)))[0].result,
      ).toBe('1-0');
      expect(await eventsOf(playerIds[0])).toEqual(published);
    } finally {
      resume.resolve();
      db.transaction = original;
      await pending.catch(() => {});
    }
  });

  test('rolls closure and player writes back if publication fails', async () => {
    const { tournamentId, playerIds } = await makeRunningTournament();
    const before = await db
      .select()
      .from(players)
      .where(eq(players.id, playerIds[0]));
    await db.insert(rating_events).values({
      id: newid(),
      playerId: playerIds[0],
      sourceTournamentId: tournamentId,
      publishedAt: new Date(),
      rating: 1500,
      ratingDeviation: 350,
      isStarting: false,
    });
    await expect(finishTournament({ tournamentId })).rejects.toBeDefined();
    expect((await tournamentRow(tournamentId)).closedAt).toBeNull();
    expect(
      await db.select().from(players).where(eq(players.id, playerIds[0])),
    ).toEqual(before);
    expect(
      (
        await db
          .select()
          .from(tournament_units)
          .where(eq(tournament_units.tournamentId, tournamentId))
      ).every((unit) => unit.place === null),
    ).toBe(true);
  });

  test('unrated closure leaves ratings and the starting-only timeline unchanged', async () => {
    const { tournamentId, playerIds } = await makeRunningTournament();
    await db
      .update(tournaments)
      .set({ rated: false })
      .where(eq(tournaments.id, tournamentId));
    const before = await eventsOf(playerIds[0]);
    await finishTournament({ tournamentId });
    expect(await eventsOf(playerIds[0])).toEqual(before);
  });
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
      expect(
        events.find((e) => e.sourceTournamentId === tournamentId)?.publishedAt,
      ).toEqual(closedAt);
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
    const outcome = eventsBefore.find((event) => !event.isStarting)!;
    expect(eventsAfter.find((event) => !event.isStarting)).toMatchObject({
      sourceTournamentId: null,
      rating: outcome.rating,
      ratingDeviation: outcome.ratingDeviation,
      publishedAt: outcome.publishedAt,
    });
  });
});
