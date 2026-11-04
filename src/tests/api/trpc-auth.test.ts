import { GET, POST } from '@/app/api/trpc/[trpc]/route';
import * as auth from '@/lib/auth/lucia';
import type { AppRouter } from '@/server/api';
import { db } from '@/server/db';
import { tournaments } from '@/server/db/schema/tournaments';
import { fixtures } from '@/server/db/seed';
import { createAuthenticatedCaller } from '@/tests/setup/utils';
import { createTRPCClient, httpLink } from '@trpc/client';
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import superjson from 'superjson';

const createBearerClient = async () => {
  const caller = await createAuthenticatedCaller(fixtures.organizer);
  const { token } = await caller.auth.apiToken.generate({ name: 'test' });
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: 'http://localhost/api/trpc',
        transformer: superjson,
        headers: { authorization: `Bearer ${token}` },
        fetch: (url, init) => {
          const request = new NextRequest(url, {
            ...init,
            signal: init?.signal ?? undefined,
          });
          return request.method === 'GET' ? GET(request) : POST(request);
        },
      }),
    ],
  });
};

const tournamentRow = (tournamentId: string) =>
  db.query.tournaments.findFirst({ where: { id: tournamentId } });

describe('bearer token without a cookie session', () => {
  const validateRequest = spyOn(auth, 'validateRequest');

  beforeAll(() =>
    validateRequest.mockResolvedValue({ user: null, session: null }),
  );

  afterAll(() => validateRequest.mockRestore());

  test('starts a tournament', async () => {
    const { tournamentId } = fixtures.ready.next().value!;
    await db
      .update(tournaments)
      .set({ startedAt: null })
      .where(eq(tournaments.id, tournamentId));

    const client = await createBearerClient();
    await client.tournament.start.mutate({
      tournamentId,
      startedAt: new Date(),
      format: 'swiss',
      roundsNumber: 1,
    });

    expect((await tournamentRow(tournamentId))?.startedAt).toBeInstanceOf(Date);
  });

  test('finishes a tournament', async () => {
    const { tournamentId } = fixtures.ready.next().value!;

    const client = await createBearerClient();
    await client.tournament.finish.mutate({ tournamentId });

    expect((await tournamentRow(tournamentId))?.closedAt).toBeInstanceOf(Date);
  });

  test('sees organiser status, resets and deletes a tournament', async () => {
    const { tournamentId } = fixtures.ready.next().value!;

    const client = await createBearerClient();
    const { status } = await client.tournament.authStatus.query({
      tournamentId,
    });
    expect(status).toBe('organizer');

    await client.tournament.reset.mutate({ tournamentId });
    expect((await tournamentRow(tournamentId))?.startedAt).toBeNull();

    await client.tournament.delete.mutate({ tournamentId });
    expect(await tournamentRow(tournamentId)).toBeUndefined();
  });

  test('adds, removes and withdraws units', async () => {
    const { tournamentId, unitIds } = fixtures.ongoing.next().value!;
    const startedAt = (await tournamentRow(tournamentId))?.startedAt;
    await db
      .update(tournaments)
      .set({ startedAt: null })
      .where(eq(tournaments.id, tournamentId));

    const client = await createBearerClient();
    const [player] = await client.tournament.playersOut.query({
      tournamentId,
    });
    const added = await client.tournament.addSoloUnit.mutate({
      tournamentId,
      player,
    });
    expect(added).toHaveLength(unitIds.length + 1);

    const unitId = added.find((unit) => !unitIds.includes(unit.id))!.id;
    const removed = await client.tournament.removeUnit.mutate({
      tournamentId,
      unitId,
    });
    expect(removed).toHaveLength(unitIds.length);

    await db
      .update(tournaments)
      .set({ startedAt, format: 'swiss' })
      .where(eq(tournaments.id, tournamentId));
    await client.tournament.withdrawUnit.mutate({
      tournamentId,
      unitId: unitIds[0],
    });
    const units = await client.tournament.units.query({ tournamentId });
    expect(units.find((unit) => unit.id === unitIds[0])?.isOut).toBe(true);
  });
});
