import { describe, expect, test } from 'bun:test';

import { fixtures } from '@/server/db/seed';
import { publishClubNotification } from '@/server/events';
import { createAuthenticatedCaller } from '@/tests/setup/utils';

// the second game is still undecided
const {
  tournamentId,
  clubId,
  gameIds: [, gameId],
} = fixtures.ongoing.next().value!;

describe('tournament events', () => {
  test('a mutation publishes its change to the tournament stream', async () => {
    const caller = await createAuthenticatedCaller(fixtures.organizer);
    const stream = (await caller.tournament.events({ tournamentId }))[
      Symbol.asyncIterator
    ]();
    const next = stream.next();

    await caller.tournament.setGameResult({ gameId, result: '1-0' });

    expect((await next).value).toEqual({
      event: 'set-game-result',
      gameId,
      result: '1-0',
      roundNumber: 1,
    });

    await stream.return?.(undefined);
    expect(
      globalThis.eventBus?.listenerCount(`tournament:${tournamentId}`),
    ).toBe(0);
  });
});

describe('tournament deletion', () => {
  test('deleting a tournament tells its viewers', async () => {
    const { tournamentId } = fixtures.ready.next().value!;
    const caller = await createAuthenticatedCaller(fixtures.organizer);
    const stream = (await caller.tournament.events({ tournamentId }))[
      Symbol.asyncIterator
    ]();
    const next = stream.next();

    await caller.tournament.delete({ tournamentId });

    expect((await next).value).toEqual({ event: 'delete-tournament' });
    await stream.return?.(undefined);
  });
});

describe('user events', () => {
  test("a club notification reaches a manager's user stream", async () => {
    const caller = await createAuthenticatedCaller(fixtures.organizer);
    const stream = (await caller.auth.events())[Symbol.asyncIterator]();
    const next = stream.next();

    publishClubNotification(clubId);

    expect((await next).value).toEqual({ event: 'club-notification', clubId });
    await stream.return?.(undefined);
  });
});
