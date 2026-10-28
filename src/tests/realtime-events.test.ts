import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';

import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { publishClubNotification } from '@/server/events';
import { createPlayer } from '@/server/mutations/club-managing';
import { createAuthenticatedCaller } from '@/tests/setup/utils';
import type { User } from 'lucia';

setDefaultTimeout(60_000);

let organizer: User;
let clubId: string;

async function makeRunningTournament() {
  const [a, b] = await Promise.all(
    ['white', 'black'].map((color) =>
      createPlayer({
        nickname: `rt ${color} ${newid()}`,
        rating: 1500,
        clubId,
      }),
    ),
  );
  const tournamentId = newid();
  await db.insert(tournaments).values({
    id: tournamentId,
    title: 'realtime test',
    format: 'round robin',
    type: 'solo',
    date: '2026-01-01',
    createdAt: new Date(),
    clubId,
    startedAt: new Date(),
    roundsNumber: 1,
    ongoingRound: 1,
    rated: false,
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
  const gameId = newid();
  await db.insert(games).values({
    id: gameId,
    gameNumber: 1,
    roundNumber: 1,
    whiteUnitId: ua,
    blackUnitId: ub,
    whitePlayerId: a.id,
    blackPlayerId: b.id,
    result: null,
    tournamentId,
  });
  return { tournamentId, gameId };
}

beforeAll(async () => {
  const manager = (await db.select().from(clubs_to_users).limit(1))[0];
  clubId = manager.clubId;
  organizer = (await db.query.users.findFirst({
    where: { id: manager.userId },
  })) as User;
});

describe('tournament events', () => {
  test('a mutation publishes its change to the tournament stream', async () => {
    const { tournamentId, gameId } = await makeRunningTournament();
    const caller = await createAuthenticatedCaller(organizer);
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

describe('user events', () => {
  test("a club notification reaches a manager's user stream", async () => {
    const caller = await createAuthenticatedCaller(organizer);
    const stream = (await caller.auth.events())[Symbol.asyncIterator]();
    const next = stream.next();

    await publishClubNotification(clubId);

    expect((await next).value).toEqual({ event: 'club-notification', clubId });
    await stream.return?.(undefined);
  });
});
