import {
  beforeAll,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from 'bun:test';
import * as nextCache from 'next/cache';

import { distanceKm } from '@/lib/geo';
import { getMockClubCoordinates } from '@/lib/mock-club-coordinates';
import { newid } from '@/lib/utils';
import { publicCaller } from '@/server/api';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournament_units, tournaments } from '@/server/db/schema/tournaments';
import { clubsEditServerSchema } from '@/server/zod/clubs.server';
import { tournamentEditLocationInputSchema } from '@/server/zod/tournaments';

// cacheTag throws outside the next runtime
mock.module('next/cache', () => ({ ...nextCache, cacheTag: () => {} }));

setDefaultTimeout(60_000);

const NEAR_RADIUS_KM = 1;

const search = `discovery-${newid()}`;
const nearClubId = newid();
const farClubId = newid();
const hiddenClubId = newid();
const ids = {
  upcoming: newid(),
  live: newid(),
  finished: newid(),
  far: newid(),
};

const collect = async <T>(
  fetchPage: (
    cursor?: number,
  ) => Promise<{ items: T[]; nextCursor: number | null }>,
) => {
  const items: T[] = [];
  let cursor: number | undefined;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
};

const tournamentIds = (
  input: Parameters<typeof publicCaller.tournament.all>[0],
) =>
  collect(async (cursor) => {
    const page = await publicCaller.tournament.all({
      ...input,
      cursor,
      limit: 2,
    });
    return {
      items: page.tournaments.map(({ tournament }) => tournament.id),
      nextCursor: page.nextCursor,
    };
  });

describe('discovery lists', () => {
  beforeAll(async () => {
    const createdAt = new Date();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await db.insert(clubs).values([
      { id: nearClubId, name: `${search} near`, createdAt },
      { id: farClubId, name: `${search} far`, createdAt },
      { id: hiddenClubId, name: `${search} personal`, createdAt },
    ]);
    const base = {
      format: 'swiss' as const,
      type: 'solo' as const,
      createdAt,
      roundsNumber: 5,
    };
    await db.insert(tournaments).values([
      {
        ...base,
        id: ids.upcoming,
        title: `${search} upcoming`,
        date: future,
        clubId: nearClubId,
      },
      {
        ...base,
        id: ids.live,
        title: `${search} live`,
        date: future,
        clubId: nearClubId,
        startedAt: createdAt,
        ongoingRound: 3,
      },
      {
        ...base,
        id: ids.finished,
        title: `${search} finished`,
        date: '2026-01-01',
        clubId: nearClubId,
        startedAt: createdAt,
        closedAt: createdAt,
        rated: false,
        format: 'round robin',
      },
      {
        ...base,
        id: ids.far,
        title: `${search} far`,
        date: '2026-01-01',
        clubId: farClubId,
        startedAt: createdAt,
        closedAt: createdAt,
      },
    ]);
    await db.insert(tournament_units).values(
      ['alpha', 'bravo', 'charlie', 'delta'].map((nickname, i) => ({
        id: newid(),
        size: 1,
        tournamentId: ids.finished,
        nickname,
        place: i + 1,
        wins: 3 - i,
        draws: 1,
      })),
    );
  });

  test('status filters split tournaments by lifecycle', async () => {
    expect(await tournamentIds({ search, status: 'upcoming' })).toEqual([
      ids.upcoming,
    ]);
    expect(await tournamentIds({ search, status: 'live' })).toEqual([ids.live]);
    expect(
      (await tournamentIds({ search, status: 'finished' })).toSorted(),
    ).toEqual([ids.finished, ids.far].toSorted());
    expect(await publicCaller.tournament.statusCounts({ search })).toEqual({
      upcoming: 1,
      live: 1,
      finished: 2,
    });
  });

  test('format and rated filters narrow the list', async () => {
    expect(
      await tournamentIds({ search, format: 'round robin', rated: false }),
    ).toEqual([ids.finished]);
  });

  test('near filter keeps tournaments within the radius and reports distance', async () => {
    const origin = getMockClubCoordinates(nearClubId);
    const farIsNear =
      distanceKm(origin, getMockClubCoordinates(farClubId)) <= NEAR_RADIUS_KM;
    const page = await publicCaller.tournament.all({
      search,
      ...origin,
      radiusKm: NEAR_RADIUS_KM,
    });
    const found = page.tournaments.map(({ tournament }) => tournament.id);
    expect(found.toSorted()).toEqual(
      [
        ids.upcoming,
        ids.live,
        ids.finished,
        ...(farIsNear ? [ids.far] : []),
      ].toSorted(),
    );
    const item = page.tournaments.find(
      ({ tournament }) => tournament.id === ids.upcoming,
    )!;
    expect(item.distanceKm).toBe(0);
    expect(item.place?.countryIso2).toBeTruthy();
  });

  test('finished tournaments carry the podium and player count', async () => {
    const page = await publicCaller.tournament.all({
      search,
      status: 'finished',
      format: 'round robin',
    });
    const [item] = page.tournaments;
    expect(item.playersCount).toBe(4);
    expect(item.podium.map(({ nickname, score }) => [nickname, score])).toEqual(
      [
        ['alpha', 3.5],
        ['bravo', 2.5],
        ['charlie', 1.5],
      ],
    );
  });

  test('club.all lists clubs with finished tournaments, with stats', async () => {
    const page = await publicCaller.club.all({ search });
    const found = page.clubs.map(({ id }) => id).toSorted();
    expect(found).toEqual([nearClubId, farClubId].toSorted());
    const near = page.clubs.find(({ id }) => id === nearClubId)!;
    expect(near.tournamentsCount).toBe(1);
    expect(near.liveTournamentsCount).toBe(1);
    expect(near.nextTournament?.id).toBe(ids.upcoming);
    expect(near.place?.cityName).toBeTruthy();
    expect(near.isNew).toBe(true);
  });

  test('club.all near filter returns one page sorted by distance', async () => {
    const page = await publicCaller.club.all({
      search,
      ...getMockClubCoordinates(nearClubId),
      radiusKm: 500,
    });
    expect(page.clubs[0].id).toBe(nearClubId);
    expect(page.clubs[0].distanceKm).toBe(0);
    expect(page.clubs.map(({ id }) => id)).not.toContain(hiddenClubId);
    expect(page.nextCursor).toBeNull();
  });

  test('club.locations returns listed clubs only', async () => {
    const locations = await publicCaller.club.locations({ search });
    expect(locations.map(({ id }) => id).toSorted()).toEqual(
      [nearClubId, farClubId].toSorted(),
    );
  });

  test('a partial near filter is rejected', async () => {
    expect(
      publicCaller.tournament.all({ latitude: 10, longitude: 10 }),
    ).rejects.toThrow();
  });
});

describe('stored locations', () => {
  const token = `located-${newid()}`;
  const clubId = newid();
  const atClubId = newid();
  const venueId = newid();
  // far from every mock city, so mock coordinates can't land near either point
  const CLUB = { latitude: 64.1466, longitude: -21.9426 };
  const VENUE = { latitude: -45.8788, longitude: 170.5028 };

  beforeAll(async () => {
    const createdAt = new Date();
    await db
      .insert(clubs)
      .values({ id: clubId, name: `${token} club`, createdAt, ...CLUB });
    const base = {
      format: 'swiss' as const,
      type: 'solo' as const,
      date: '2026-01-01',
      createdAt,
      clubId,
      startedAt: createdAt,
      closedAt: createdAt,
    };
    await db.insert(tournaments).values([
      { ...base, id: atClubId, title: `${token} at club` },
      { ...base, id: venueId, title: `${token} venue`, ...VENUE },
    ]);
  });

  test('a club with a stored location is placed there', async () => {
    const page = await publicCaller.club.all({
      search: token,
      ...CLUB,
      radiusKm: 1,
    });
    expect(page.clubs.map(({ id }) => id)).toEqual([clubId]);
    expect(page.clubs[0].distanceKm).toBe(0);
    expect(page.clubs[0].place?.countryIso2).toBe('IS');
  });

  test('a tournament venue overrides its club location', async () => {
    const nearClub = await publicCaller.tournament.all({
      search: token,
      ...CLUB,
      radiusKm: 1,
    });
    expect(nearClub.tournaments.map(({ tournament }) => tournament.id)).toEqual(
      [atClubId],
    );
    const nearVenue = await publicCaller.tournament.all({
      search: token,
      ...VENUE,
      radiusKm: 1,
    });
    expect(
      nearVenue.tournaments.map(({ tournament }) => tournament.id),
    ).toEqual([venueId]);
    expect(nearVenue.tournaments[0].place?.countryIso2).toBe('NZ');
    expect(
      await publicCaller.tournament.statusCounts({
        search: token,
        ...VENUE,
        radiusKm: 1,
      }),
    ).toEqual({ upcoming: 0, live: 0, finished: 1 });
  });

  test('a location needs both coordinates', async () => {
    const half = tournamentEditLocationInputSchema.safeParse({
      tournamentId: venueId,
      latitude: 10,
      longitude: null,
    });
    expect(half.success).toBe(false);
    const cleared = tournamentEditLocationInputSchema.safeParse({
      tournamentId: venueId,
      latitude: null,
      longitude: null,
    });
    expect(cleared.success).toBe(true);
    const club = await clubsEditServerSchema.safeParseAsync({
      clubId,
      latitude: 10,
    });
    expect(club.success).toBe(false);
  });
});
