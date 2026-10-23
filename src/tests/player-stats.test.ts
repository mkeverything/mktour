import {
  beforeAll,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from 'bun:test';
import { eq, inArray } from 'drizzle-orm';

import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { player_stats, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
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
import type { GameResult } from '@/server/zod/enums';

let organizerId: string;
mock.module('@/lib/auth/lucia', () => ({
  validateRequest: async () => ({
    user: { id: organizerId },
    session: { id: 'test', userId: organizerId },
  }),
}));

setDefaultTimeout(60_000);

beforeAll(async () => {
  const organizer = (await db.select().from(clubs_to_users).limit(1))[0];
  organizerId = organizer.userId;
});

/** a fresh club per test keeps club-wide ranks independent of other tests */
async function makeClub() {
  const clubId = newid();
  await db
    .insert(clubs)
    .values({ id: clubId, name: `stats ${clubId}`, createdAt: new Date() });
  await db.insert(clubs_to_users).values({
    id: newid(),
    clubId,
    userId: organizerId,
    status: 'admin',
  });
  return clubId;
}

async function makePlayer(
  clubId: string,
  established?: { rating: number; ratingDeviation: number },
) {
  const player = await createPlayer({
    nickname: `ps ${newid()}`,
    rating: 1500,
    clubId,
  });
  if (established) {
    await db
      .update(players)
      .set({ ...established, ratingLastUpdateAt: new Date() })
      .where(eq(players.id, player.id));
  }
  return player.id;
}

/** closes a one-round rated solo tournament with one unit per player through the real mutation */
async function closeTournament(
  clubId: string,
  playerIds: string[],
  results: [white: number, black: number, result: GameResult][],
) {
  const tournamentId = newid();
  await db.insert(tournaments).values({
    id: tournamentId,
    title: 'player stats test',
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
  const unitIds = playerIds.map(() => newid());
  await db.insert(tournament_units).values(
    unitIds.map((id, i) => ({
      id,
      size: 1,
      tournamentId,
      nickname: `unit ${i}`,
      wins: results.filter(
        ([w, b, r]) => (w === i && r === '1-0') || (b === i && r === '0-1'),
      ).length,
      draws: results.filter(
        ([w, b, r]) => (w === i || b === i) && r === '1/2-1/2',
      ).length,
      losses: results.filter(
        ([w, b, r]) => (w === i && r === '0-1') || (b === i && r === '1-0'),
      ).length,
    })),
  );
  await db.insert(players_to_units).values(
    playerIds.map((playerId, i) => ({
      id: `${playerId}_${unitIds[i]}`,
      playerId,
      unitId: unitIds[i],
      numberInUnit: 1,
    })),
  );
  await db.insert(games).values(
    results.map(([w, b, result], i) => ({
      id: newid(),
      gameNumber: i + 1,
      roundNumber: 1,
      whiteUnitId: unitIds[w],
      blackUnitId: unitIds[b],
      whitePlayerId: playerIds[w],
      blackPlayerId: playerIds[b],
      result,
      finishedAt: new Date(),
      tournamentId,
    })),
  );
  await finishTournament({ tournamentId });
  return tournamentId;
}

const statsOf = async (playerId: string) =>
  (
    await db
      .select()
      .from(player_stats)
      .where(eq(player_stats.playerId, playerId))
  )[0];

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
    overrides: Partial<{
      rating: number;
      ratingDeviation: number;
      ratingLastUpdateAt: Date;
      tournamentsPlayed: number;
      tournamentsWon: number;
      gamesWon: number;
    }> = {},
  ) => ({
    playerId,
    rating: 1500,
    ratingDeviation: 50,
    ratingVolatility: GLICKO2_CONSTANTS.DEFAULT_VOLATILITY,
    ratingLastUpdateAt: now,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    gamesWon: 0,
    gamesDrawn: 0,
    gamesLost: 0,
    ...overrides,
  });

  test('breaks every metric tie by rating, then stored rd, then id', () => {
    const ranked = rankClubPlayers(
      [
        player('b', { rating: 1600, tournamentsPlayed: 2 }),
        player('a', { rating: 1600, tournamentsPlayed: 2 }),
        player('c', {
          rating: 1600,
          ratingDeviation: 40,
          tournamentsPlayed: 2,
        }),
        player('d', { rating: 1700, tournamentsPlayed: 2 }),
        player('e', { rating: 1900, tournamentsPlayed: 1 }),
      ],
      now,
    );
    expect(
      Object.fromEntries(
        ranked.map((p) => [p.playerId, p.tournamentsPlayedRank]),
      ),
    ).toEqual({ d: 1, c: 2, a: 3, b: 4, e: 5 });
    expect(
      Object.fromEntries(ranked.map((p) => [p.playerId, p.ratingRank])),
    ).toEqual({ e: 1, d: 2, c: 3, a: 4, b: 5 });
  });

  test('preserves input order and leaves ineligible players unranked', () => {
    const ranked = rankClubPlayers(
      [
        player('provisional', { rating: 2000, ratingDeviation: 200 }),
        player('stale', {
          rating: 1900,
          ratingDeviation: 100,
          ratingLastUpdateAt: new Date('2020-01-01T00:00:00Z'),
        }),
        player('winner', {
          tournamentsPlayed: 1,
          tournamentsWon: 1,
          gamesWon: 2,
        }),
        player('idle'),
      ],
      now,
    );
    expect(ranked.map((p) => p.playerId)).toEqual([
      'provisional',
      'stale',
      'winner',
      'idle',
    ]);
    expect(ranked.map((p) => p.ratingRank)).toEqual([null, null, 2, 1]);
    expect(ranked.map((p) => p.tournamentsWonRank)).toEqual([
      null,
      null,
      1,
      null,
    ]);
    expect(ranked.map((p) => p.gamesPlayedRank)).toEqual([null, null, 1, null]);
  });
});

describe('player stats projection', () => {
  test('player creation inserts an unranked zero row without re-ranking', async () => {
    const clubId = await makeClub();
    const playerId = await makePlayer(clubId);

    expect(await getPlayerStats(playerId)).toEqual({
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
    const clubId = await makeClub();
    const [a, b, c] = [
      await makePlayer(clubId),
      await makePlayer(clubId),
      await makePlayer(clubId),
    ];
    const outsider = await makePlayer(clubId, {
      rating: 1600,
      ratingDeviation: 50,
    });
    expect((await statsOf(outsider)).ratingRank).toBeNull();

    const tournamentId = await closeTournament(
      clubId,
      [a, b, c],
      [
        [0, 1, '1-0'],
        [2, 0, '1/2-1/2'],
      ],
    );

    expect(await statsOf(a)).toMatchObject({
      tournamentsPlayed: 1,
      tournamentsWon: 1,
      gamesWon: 1,
      gamesDrawn: 1,
      gamesLost: 0,
      gamesPlayed: 2,
      ratingRank: null,
      tournamentsPlayedRank: 1,
      tournamentsWonRank: 1,
      gamesPlayedRank: 1,
    });
    expect(await statsOf(c)).toMatchObject({
      tournamentsPlayed: 1,
      tournamentsWon: 0,
      gamesDrawn: 1,
      gamesPlayed: 1,
      tournamentsPlayedRank: 2,
      tournamentsWonRank: null,
      gamesPlayedRank: 2,
    });
    expect(await statsOf(b)).toMatchObject({
      gamesLost: 1,
      tournamentsPlayedRank: 3,
      gamesPlayedRank: 3,
    });
    expect(await statsOf(outsider)).toMatchObject({
      tournamentsPlayed: 0,
      ratingRank: 1,
      tournamentsPlayedRank: null,
    });

    await deleteTournament({ tournamentId });

    for (const playerId of [a, b, c]) {
      expect(await statsOf(playerId)).toMatchObject({
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        gamesPlayed: 0,
        tournamentsPlayedRank: null,
        tournamentsWonRank: null,
        gamesPlayedRank: null,
      });
    }
    expect((await statsOf(outsider)).ratingRank).toBe(1);
  });

  test('re-ranking can swap stored positions despite the rank indexes', async () => {
    const clubId = await makeClub();
    const first = await makePlayer(clubId, {
      rating: 1700,
      ratingDeviation: 50,
    });
    const second = await makePlayer(clubId, {
      rating: 1600,
      ratingDeviation: 50,
    });
    await refreshPlayerStats(db, { clubId, playerIds: [], now: new Date() });
    expect(await ratingRanksOf([first, second])).toEqual([1, 2]);

    await db
      .update(players)
      .set({ rating: 1800 })
      .where(eq(players.id, second));
    await refreshPlayerStats(db, { clubId, playerIds: [], now: new Date() });
    expect(await ratingRanksOf([first, second])).toEqual([2, 1]);
  });

  test('deleting a rating-ranked player closes the gap', async () => {
    const clubId = await makeClub();
    const ids = [
      await makePlayer(clubId, { rating: 1700, ratingDeviation: 50 }),
      await makePlayer(clubId, { rating: 1600, ratingDeviation: 50 }),
      await makePlayer(clubId, { rating: 1500, ratingDeviation: 50 }),
    ];
    await refreshPlayerStats(db, { clubId, playerIds: [], now: new Date() });
    expect(await ratingRanksOf(ids)).toEqual([1, 2, 3]);

    await deletePlayer({ playerId: ids[0] });

    expect(await statsOf(ids[0])).toBeUndefined();
    expect(await ratingRanksOf(ids.slice(1))).toEqual([1, 2]);
  });

  test('merging moves history onto the base row and removes the merged row', async () => {
    const clubId = await makeClub();
    const [base, merged, opponent] = [
      await makePlayer(clubId),
      await makePlayer(clubId),
      await makePlayer(clubId),
    ];
    await closeTournament(clubId, [merged, opponent], [[0, 1, '1-0']]);
    expect((await statsOf(base)).tournamentsPlayed).toBe(0);

    await mergePlayers({ clubId, basePlayerId: base, mergedPlayerId: merged });

    expect(await statsOf(merged)).toBeUndefined();
    expect(await statsOf(base)).toMatchObject({
      tournamentsPlayed: 1,
      tournamentsWon: 1,
      gamesWon: 1,
      gamesPlayed: 1,
      tournamentsPlayedRank: 1,
      tournamentsWonRank: 1,
      gamesPlayedRank: 1,
    });
    expect(await statsOf(opponent)).toMatchObject({
      tournamentsWon: 0,
      tournamentsPlayedRank: 2,
      tournamentsWonRank: null,
    });
  });

  test('doubles credit every partner, tied first places each win, byes and open tournaments count no games', async () => {
    const clubId = await makeClub();
    const ids: string[] = [];
    for (const rating of [1700, 1650, 1600, 1550, 1500, 1450]) {
      const id = await makePlayer(clubId);
      await db.update(players).set({ rating }).where(eq(players.id, id));
      ids.push(id);
    }
    const [p1, p2, p3, p4, p5, p6] = ids;

    const insertDoublesTournament = async (
      closedAt: Date | null,
      units: { id: string; playerIds: string[]; place: number | null }[],
      tournamentGames: {
        round: number;
        white: string;
        black: string;
        result: GameResult;
        whitePlayerId?: string;
        blackPlayerId?: string;
      }[],
    ) => {
      const tournamentId = newid();
      await db.insert(tournaments).values({
        id: tournamentId,
        title: 'doubles stats test',
        format: 'swiss',
        type: 'doubles',
        date: '2026-01-01',
        createdAt: new Date(),
        clubId,
        startedAt: new Date(),
        closedAt,
        roundsNumber: 2,
        ongoingRound: 2,
        rated: false,
      });
      await db.insert(tournament_units).values(
        units.map((unit) => ({
          id: unit.id,
          size: 2,
          tournamentId,
          nickname: unit.id,
          place: unit.place,
        })),
      );
      await db.insert(players_to_units).values(
        units.flatMap((unit) =>
          unit.playerIds.map((playerId, i) => ({
            id: `${playerId}_${unit.id}`,
            playerId,
            unitId: unit.id,
            numberInUnit: i + 1,
          })),
        ),
      );
      await db.insert(games).values(
        tournamentGames.map((game, i) => ({
          id: newid(),
          gameNumber: i + 1,
          roundNumber: game.round,
          whiteUnitId: game.white,
          blackUnitId: game.black,
          whitePlayerId: game.whitePlayerId ?? null,
          blackPlayerId: game.blackPlayerId ?? null,
          result: game.result,
          finishedAt: new Date(),
          tournamentId,
        })),
      );
    };

    const [a, b, c, d, e] = [newid(), newid(), newid(), newid(), newid()];
    await insertDoublesTournament(
      new Date(),
      [
        { id: a, playerIds: [p1, p2], place: 1 },
        { id: b, playerIds: [p3, p4], place: 1 },
        { id: c, playerIds: [p5, p6], place: 3 },
      ],
      [
        { round: 1, white: a, black: b, result: '1/2-1/2' },
        {
          round: 2,
          white: c,
          black: a,
          result: '1-0',
          whitePlayerId: p5,
          blackPlayerId: p1,
        },
      ],
    );
    await insertDoublesTournament(
      null,
      [
        { id: d, playerIds: [p1, p2], place: null },
        { id: e, playerIds: [p3, p4], place: null },
      ],
      [{ round: 1, white: d, black: e, result: '1-0' }],
    );

    const now = new Date();
    await refreshPlayerStats(db, { clubId, playerIds: ids, now });

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
      [1, 0, 1, 0, 0, 5, null, 5],
      [1, 0, 0, 0, 0, 6, null, null],
    ]);

    const rebuilt = await buildClubPlayerStats(db, clubId, now);
    expect(
      rebuilt.toSorted((x, y) => x.playerId.localeCompare(y.playerId)),
    ).toEqual(
      stored
        .map(({ gamesPlayed: _, ...row }) => row)
        .toSorted((x, y) => x.playerId.localeCompare(y.playerId)),
    );
  });
});
