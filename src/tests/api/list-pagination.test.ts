import {
  beforeAll,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from 'bun:test';
import { eq, isNotNull } from 'drizzle-orm';
import * as nextCache from 'next/cache';

import { newid } from '@/lib/utils';
import { publicCaller } from '@/server/api';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';

// cacheTag throws outside the next runtime
mock.module('next/cache', () => ({ ...nextCache, cacheTag: () => {} }));

setDefaultTimeout(60_000);

// smaller than the tied group below, so a page boundary falls inside it
const PAGE_SIZE = 2;

async function collectIds(
  fetchPage: (cursor?: number) => Promise<[string[], number | null]>,
) {
  const ids: string[] = [];
  let cursor: number | undefined;
  do {
    const [page, nextCursor] = await fetchPage(cursor);
    ids.push(...page);
    cursor = nextCursor ?? undefined;
  } while (cursor !== undefined);
  return ids;
}

describe('list pagination', () => {
  beforeAll(async () => {
    // future-dated so they head the lists: 3 clubs and 6 tournaments sharing one createdAt
    const createdAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const clubIds = [newid(), newid(), newid()];
    await db
      .insert(clubs)
      .values(
        clubIds.map((id) => ({ id, name: `pagination ${id}`, createdAt })),
      );
    await db.insert(tournaments).values(
      clubIds.flatMap((clubId) =>
        [0, 1].map(() => ({
          id: newid(),
          title: 'pagination test',
          format: 'round robin' as const,
          type: 'solo' as const,
          date: '2026-01-01',
          createdAt,
          clubId,
          startedAt: createdAt,
          closedAt: createdAt,
        })),
      ),
    );
  });

  test('tournament.all returns every tournament exactly once', async () => {
    const ids = await collectIds(async (cursor) => {
      const page = await publicCaller.tournament.all({
        limit: PAGE_SIZE,
        cursor,
      });
      return [
        page.tournaments.map(({ tournament }) => tournament.id),
        page.nextCursor,
      ];
    });
    const expected = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id));

    expect(ids.length).toBe(new Set(ids).size);
    expect(ids.toSorted()).toEqual(expected.map(({ id }) => id).toSorted());
  });

  test('club.all returns every club with a finished tournament exactly once', async () => {
    const ids = await collectIds(async (cursor) => {
      const page = await publicCaller.club.all({ limit: PAGE_SIZE, cursor });
      return [page.clubs.map(({ id }) => id), page.nextCursor];
    });
    const expected = await db
      .selectDistinct({ id: clubs.id })
      .from(clubs)
      .innerJoin(tournaments, eq(clubs.id, tournaments.clubId))
      .where(isNotNull(tournaments.closedAt));

    expect(ids.length).toBe(new Set(ids).size);
    expect(ids.toSorted()).toEqual(expected.map(({ id }) => id).toSorted());
  });
});
