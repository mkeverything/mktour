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

const createBearerClient = async (user = fixtures.organizer) => {
  const caller = await createAuthenticatedCaller(user);
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

  test('requests, aborts and accepts affiliations with notifications', async () => {
    const { clubId, playerIds } = fixtures.clubs.next().value!;
    const member = await createBearerClient(fixtures.member);
    const organizer = await createBearerClient();
    const unseen = () => member.auth.notifications.counter.query();
    const initiallyUnseen = await unseen();

    await member.player.affiliation.request.mutate({
      playerId: playerIds[0],
      clubId,
    });
    const requested = await member.club.authAffiliation.query({ clubId });
    await member.player.affiliation.abortRequest.mutate({
      playerId: playerIds[0],
      affiliationId: requested!.id,
    });
    expect(await member.club.authAffiliation.query({ clubId })).toBeNull();

    await member.player.affiliation.request.mutate({
      playerId: playerIds[1],
      clubId,
    });
    const { id: affiliationId } = (await member.club.authAffiliation.query({
      clubId,
    }))!;
    await organizer.player.affiliation.accept.mutate({
      clubId,
      affiliationId,
    });
    expect(await unseen()).toBe(initiallyUnseen + 1);

    const {
      notifications: [{ notification }],
    } = await member.auth.notifications.infinite.query({ limit: 1 });
    const seen = { notificationId: notification.id, seen: true };
    await organizer.auth.notifications.changeStatus.mutate(seen);
    expect(await unseen()).toBe(initiallyUnseen + 1);
    await member.auth.notifications.changeStatus.mutate(seen);
    expect(await unseen()).toBe(initiallyUnseen);

    await member.auth.notifications.changeStatus.mutate({
      ...seen,
      seen: false,
    });
    await member.auth.notifications.markAllAsSeen.mutate();
    expect(await unseen()).toBe(0);
  });

  test('reads club status and selects a club', async () => {
    const clubId = fixtures.organizer.selectedClub;
    const client = await createBearerClient();

    expect(await client.club.authStatus.query({ clubId })).toBe('co-owner');
    expect(await client.auth.selectClub.mutate({ clubId })).toBe(clubId);
  });

  test('cannot delete the account', async () => {
    const user = fixtures.users.next().value!;
    const client = await createBearerClient(user);

    await expect(
      client.auth.delete.mutate({ userId: user.id }),
    ).rejects.toMatchObject({ message: 'UNAUTHENTICATED' });
  });
});
