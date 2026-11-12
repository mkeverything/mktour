import { describe, expect, test } from 'bun:test';
import { eq, isNotNull } from 'drizzle-orm';

import { publicCaller } from '@/server/api';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { fixtures } from '@/server/db/seed';
import { ClubPlayersFilterModel } from '@/server/zod/players';

// smaller than the seeded history's tied groups, so page boundaries fall
// inside them
const PAGE_SIZE = 2;

const [{ clubId, playerIds }] = fixtures.history;

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

  test('club.tournaments returns every club tournament exactly once', async () => {
    const ids = await collectIds(async (cursor) => {
      const page = await publicCaller.club.tournaments({
        clubId,
        limit: PAGE_SIZE,
        cursor,
      });
      return [page.tournaments.map(({ id }) => id), page.nextCursor];
    });
    const expected = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.clubId, clubId));

    expect(ids.length).toBe(new Set(ids).size);
    expect(ids.toSorted()).toEqual(expected.map(({ id }) => id).toSorted());
  });

  test("player.results returns each of the player's tournaments exactly once, with their result", async () => {
    // the second player wins a two-player round in every tournament of the club
    const [, playerId] = playerIds;
    const ids = await collectIds(async (cursor) => {
      const page = await publicCaller.player.results({
        playerId,
        limit: PAGE_SIZE,
        cursor,
      });
      for (const result of page.results) {
        expect(result).toMatchObject({
          unit: { place: null, wins: 1, draws: 0, losses: 0 },
          unitsCount: 2,
        });
      }
      return [
        page.results.map(({ tournament }) => tournament.id),
        page.nextCursor,
      ];
    });
    const expected = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.clubId, clubId));

    expect(ids.length).toBe(new Set(ids).size);
    expect(ids.toSorted()).toEqual(expected.map(({ id }) => id).toSorted());
  });

  test('club.players sorts both ways, rating and tournaments along their stored ranks', async () => {
    const collectRows = (filter: ClubPlayersFilterModel) =>
      collectIds(async (cursor) => {
        const page = await publicCaller.club.players({
          clubId,
          limit: PAGE_SIZE,
          cursor,
          ...filter,
        });
        return [
          page.players.map(
            ({ id, ratingRank, tournamentsPlayedRank }) =>
              `${filter.sortBy === 'tournamentsPlayed' ? tournamentsPlayedRank : ratingRank} ${id}`,
          ),
          page.nextCursor,
        ];
      });
    const numbered = (ids: string[]) => ids.map((id, i) => `${i + 1} ${id}`);
    const [p0, p1, p2, p3] = playerIds;
    // rating ties put the most recently seen first
    const byRating = numbered([p0, p3, p2, p1]);
    const byTournaments = numbered([p3, p1, p0, p2]);
    const byNickname = [`1 ${p0}`, `4 ${p1}`, `3 ${p2}`, `2 ${p3}`];

    for (const [sortBy, order, expected] of [
      ['rating', 'desc', byRating],
      ['nickname', 'asc', byNickname],
      ['tournamentsPlayed', 'desc', byTournaments],
    ] as const) {
      expect(await collectRows({ sortBy, order })).toEqual(expected);
      expect(
        await collectRows({ sortBy, order: order === 'asc' ? 'desc' : 'asc' }),
      ).toEqual(expected.toReversed());
    }
    expect(
      await collectRows({
        sortBy: 'tournamentsPlayed',
        order: 'desc',
        search: 'PLAYER 3',
      }),
    ).toEqual([byTournaments[0]]);
  });
});
