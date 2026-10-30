import { describe, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';

import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { player_stats, players } from '@/server/db/schema/players';
import { fixtures } from '@/server/db/seed';
import { createPlayer, deletePlayer } from '@/server/mutations/club-managing';
import { mergePlayers } from '@/server/mutations/player-merge';
import {
  buildClubPlayerStats,
  rankClubPlayers,
  refreshPlayerStats,
} from '@/server/mutations/player-stats';
import {
  deleteTournament,
  finishTournament,
} from '@/server/mutations/tournament-lifecycle';
import { getPlayerStats } from '@/server/queries/player';

const statsOf = async (playerId: string) =>
  (
    await db
      .select()
      .from(player_stats)
      .where(eq(player_stats.playerId, playerId))
  )[0];

const refreshClub = (clubId: string) =>
  db.transaction((tx) => refreshPlayerStats(tx, { clubId, playerIds: [] }));

/** the stored projection must equal one rebuilt from source tables */
const expectRebuiltStats = async (clubId: string) => {
  const byPlayer = <T extends { playerId: string }>(rows: T[]) =>
    rows.toSorted((x, y) => x.playerId.localeCompare(y.playerId));
  const stored = await db
    .select()
    .from(player_stats)
    .where(eq(player_stats.clubId, clubId));
  expect(byPlayer(stored.map(({ gamesPlayed: _, ...row }) => row))).toEqual(
    byPlayer(await buildClubPlayerStats(db, clubId)),
  );
};

const ratingRanksOf = async (playerIds: string[]) => {
  const rows = await db
    .select({
      playerId: player_stats.playerId,
      ratingRank: player_stats.ratingRank,
    })
    .from(player_stats)
    .where(inArray(player_stats.playerId, playerIds));
  return playerIds.map(
    (id) => rows.find((row) => row.playerId === id)?.ratingRank,
  );
};

describe('rankClubPlayers', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const player = (
    playerId: string,
    overrides: Partial<Parameters<typeof rankClubPlayers>[0][number]> = {},
  ) => ({
    playerId,
    rating: 1500,
    ratingDeviation: 50,
    lastSeenAt: now,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    gamesWon: 0,
    gamesDrawn: 0,
    gamesLost: 0,
    ...overrides,
  });

  test('breaks every metric tie by rating, stored rd, last seen, then id', () => {
    const ranked = rankClubPlayers([
      player('f', { rating: 1600, tournamentsPlayed: 2 }),
      player('a', { rating: 1600, tournamentsPlayed: 2 }),
      player('b', {
        rating: 1600,
        lastSeenAt: new Date('2026-05-01T12:00:00Z'),
        tournamentsPlayed: 2,
      }),
      player('c', { rating: 1600, ratingDeviation: 40, tournamentsPlayed: 2 }),
      player('d', { rating: 1700, tournamentsPlayed: 2 }),
      player('e', { rating: 1900, tournamentsPlayed: 1 }),
    ]);
    expect(
      Object.fromEntries(
        ranked.map((p) => [p.playerId, p.tournamentsPlayedRank]),
      ),
    ).toEqual({ d: 1, c: 2, b: 3, a: 4, f: 5, e: 6 });
    expect(
      Object.fromEntries(ranked.map((p) => [p.playerId, p.ratingRank])),
    ).toEqual({ e: 1, d: 2, c: 3, b: 4, a: 5, f: 6 });
  });

  test('preserves input order and numbers every player, zero counts included', () => {
    const ranked = rankClubPlayers([
      player('provisional', { rating: 2000, ratingDeviation: 350 }),
      player('winner', {
        tournamentsPlayed: 1,
        tournamentsWon: 1,
        gamesWon: 2,
      }),
      player('idle', { rating: 1400 }),
    ]);
    expect(ranked.map((p) => p.playerId)).toEqual([
      'provisional',
      'winner',
      'idle',
    ]);
    expect(ranked.map((p) => p.ratingRank)).toEqual([1, 2, 3]);
    expect(ranked.map((p) => p.tournamentsWonRank)).toEqual([2, 1, 3]);
    expect(ranked.map((p) => p.gamesPlayedRank)).toEqual([2, 1, 3]);
  });
});

describe('player stats projection', () => {
  test('player creation inserts an unranked zero row without re-ranking', async () => {
    const player = await createPlayer({
      nickname: `ps ${newid()}`,
      rating: 1500,
      clubId: fixtures.clubs.next().value!.clubId,
    });

    expect(await getPlayerStats(player.id)).toEqual({
      tournamentsPlayed: 0,
      tournamentsWon: 0,
      gamesWon: 0,
      gamesDrawn: 0,
      gamesLost: 0,
      gamesPlayed: 0,
      ratingRank: null,
      tournamentsPlayedRank: null,
      tournamentsWonRank: null,
      gamesPlayedRank: null,
    });
  });

  test('reading a missing row throws PLAYER_NOT_FOUND', async () => {
    await expect(getPlayerStats(newid())).rejects.toMatchObject({
      message: 'PLAYER_NOT_FOUND',
    });
  });

  test('closing a tournament refreshes participant counts and re-ranks the whole club', async () => {
    const { clubId, tournamentId, playerIds } = fixtures.ready.next().value!;
    const counts = async (playerId: string) => {
      const row = await statsOf(playerId);
      return [
        row.tournamentsPlayed,
        row.gamesWon,
        row.gamesDrawn,
        row.gamesLost,
      ];
    };

    await finishTournament({ tournamentId });

    // white wins both games; the fifth player has a bye, the sixth never entered
    expect(await Promise.all(playerIds.map(counts))).toEqual([
      [1, 1, 0, 0],
      [1, 0, 0, 1],
      [1, 1, 0, 0],
      [1, 0, 0, 1],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    await expectRebuiltStats(clubId);

    await deleteTournament({ tournamentId });

    expect(await Promise.all(playerIds.map(counts))).toEqual(
      playerIds.map(() => [0, 0, 0, 0]),
    );
    await expectRebuiltStats(clubId);
  });

  test('re-ranking can swap stored positions despite the rank indexes', async () => {
    const {
      clubId,
      playerIds: [first, second],
    } = fixtures.ready.next().value!;
    for (const [playerId, rating] of [
      [first, 1700],
      [second, 1600],
    ] as const) {
      await db.update(players).set({ rating }).where(eq(players.id, playerId));
    }
    await refreshClub(clubId);
    expect(await ratingRanksOf([first, second])).toEqual([1, 2]);

    await db
      .update(players)
      .set({ rating: 1800 })
      .where(eq(players.id, second));
    await refreshClub(clubId);
    expect(await ratingRanksOf([first, second])).toEqual([2, 1]);
  });

  test('deleting a rating-ranked player closes the gap', async () => {
    const { clubId, playerIds } = fixtures.ready.next().value!;
    // the sixth player never entered the club's round, so it can be deleted
    const [outsider, rest] = [playerIds[5], playerIds.slice(0, 5)];
    await db
      .update(players)
      .set({ rating: 1700 })
      .where(eq(players.id, outsider));
    await refreshClub(clubId);
    expect(await ratingRanksOf([outsider])).toEqual([1]);

    await deletePlayer({ playerId: outsider });

    expect(await statsOf(outsider)).toBeUndefined();
    expect((await ratingRanksOf(rest)).toSorted()).toEqual([1, 2, 3, 4, 5]);
  });

  test('merging moves history onto the base row and removes the merged row', async () => {
    // the first player wins its game; the sixth never entered
    const {
      clubId,
      tournamentId,
      playerIds: [merged, , , , , base],
    } = fixtures.ready.next().value!;
    await finishTournament({ tournamentId });
    expect((await statsOf(base)).tournamentsPlayed).toBe(0);

    await mergePlayers({ clubId, basePlayerId: base, mergedPlayerId: merged });

    expect(await statsOf(merged)).toBeUndefined();
    expect(await statsOf(base)).toMatchObject({
      tournamentsPlayed: 1,
      gamesWon: 1,
      gamesPlayed: 1,
    });
    await expectRebuiltStats(clubId);
  });

  test('doubles credit every partner, tied first places each win, byes and open tournaments count no games', async () => {
    // pairs of consecutive players; the seed's doubles fixture lists their games
    const { clubId, playerIds: ids } = fixtures.doubles;
    for (const [i, id] of ids.entries()) {
      await db
        .update(players)
        .set({ rating: 1700 - 50 * i })
        .where(eq(players.id, id));
    }

    await db.transaction((tx) =>
      refreshPlayerStats(tx, { clubId, playerIds: ids }),
    );
    const stored = await db
      .select()
      .from(player_stats)
      .where(eq(player_stats.clubId, clubId));
    const byId = new Map(stored.map((row) => [row.playerId, row]));
    const project = (id: string) => {
      const row = byId.get(id)!;
      return [
        row.tournamentsPlayed,
        row.tournamentsWon,
        row.gamesWon,
        row.gamesDrawn,
        row.gamesLost,
        row.tournamentsPlayedRank,
        row.tournamentsWonRank,
        row.gamesPlayedRank,
      ];
    };
    expect(ids.map(project)).toEqual([
      [1, 1, 0, 1, 1, 1, 1, 1],
      [1, 1, 0, 1, 0, 2, 2, 2],
      [1, 1, 0, 1, 0, 3, 3, 3],
      [1, 1, 0, 1, 0, 4, 4, 4],
      [1, 0, 1, 0, 0, 5, 5, 5],
      [1, 0, 0, 0, 0, 6, 6, 6],
    ]);
    await expectRebuiltStats(clubId);
  });
});
