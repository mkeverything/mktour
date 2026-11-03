import { describe, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';

import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { player_stats, players } from '@/server/db/schema/players';
import { fixtures } from '@/server/db/seed';
import { createPlayer, deletePlayer } from '@/server/mutations/club-managing';
import { mergePlayers } from '@/server/mutations/player-merge';
import { refreshPlayerStats } from '@/server/mutations/player-stats';
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

/** recounting and re-ranking the whole club must leave the stored rows as they are */
const expectFreshStats = async (clubId: string) => {
  const clubStats = () =>
    db
      .select()
      .from(player_stats)
      .where(eq(player_stats.clubId, clubId))
      .orderBy(player_stats.playerId);
  const stored = await clubStats();
  await db.transaction((tx) =>
    refreshPlayerStats(tx, {
      clubId,
      playerIds: stored.map(({ playerId }) => playerId),
    }),
  );
  expect(await clubStats()).toEqual(stored);
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
    await expectFreshStats(clubId);

    await deleteTournament({ tournamentId });

    expect(await Promise.all(playerIds.map(counts))).toEqual(
      playerIds.map(() => [0, 0, 0, 0]),
    );
    await expectFreshStats(clubId);
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

    await deletePlayer({ playerId: outsider, clubId });

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
    await expectFreshStats(clubId);
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
    await expectFreshStats(clubId);
  });
});
