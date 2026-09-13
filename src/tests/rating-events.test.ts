import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';

import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players, rating_events } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { createPlayer } from '@/server/mutations/club-managing';
import { mergePlayers } from '@/server/mutations/player-merge';
import { calculateAndApplyGlickoRatings } from '@/server/mutations/rating-calculation';
import { getSeededTestData } from '@/tests/setup/utils';

import type { GameResult } from '@/server/zod/enums';

const WEEK = GLICKO2_CONSTANTS.RATING_PERIOD_MS;

// every fixture is a handful of remote round trips
setDefaultTimeout(60_000);

let clubId: string;

const eventsOf = (playerId: string) =>
  db
    .select()
    .from(rating_events)
    .where(eq(rating_events.playerId, playerId))
    .orderBy(asc(rating_events.publishedAt), asc(rating_events.id));

const playerRow = async (playerId: string) =>
  (await db.select().from(players).where(eq(players.id, playerId)))[0];

async function makePlayer(
  opts: { ratingDeviation?: number; lastUpdateWeeksAgo?: number } = {},
) {
  const player = await createPlayer({
    nickname: `re ${newid()}`,
    rating: 1500,
    clubId,
  });
  if (opts.ratingDeviation !== undefined || opts.lastUpdateWeeksAgo) {
    await db
      .update(players)
      .set({
        ratingDeviation: opts.ratingDeviation ?? player.ratingDeviation,
        ratingLastUpdateAt: new Date(
          Date.now() - (opts.lastUpdateWeeksAgo ?? 0) * WEEK,
        ),
      })
      .where(eq(players.id, player.id));
  }
  return player.id;
}

// sequential: parallel writers on one sqlite file race for the lock (SQLITE_BUSY)
async function makePlayers(...opts: Parameters<typeof makePlayer>[0][]) {
  const ids: string[] = [];
  for (const o of opts) ids.push(await makePlayer(o));
  return ids;
}

/** closed rated solo tournament with one unit per player and the given games */
async function makeRatedTournament(
  playerIds: string[],
  results: [white: number, black: number, result: GameResult][],
) {
  const tournamentId = newid();
  await db.insert(tournaments).values({
    id: tournamentId,
    title: 'rating events test',
    format: 'round robin',
    type: 'solo',
    date: '2026-01-01',
    createdAt: new Date(),
    clubId,
    startedAt: new Date(),
    closedAt: new Date(),
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
  return tournamentId;
}

const publish = (tournamentId: string, publishedAt = new Date()) =>
  db.transaction((tx) =>
    calculateAndApplyGlickoRatings(tournamentId, tx, publishedAt),
  );

beforeAll(async () => {
  const { firstClub } = await getSeededTestData();
  clubId = firstClub.id;
});

describe('rating events', () => {
  test("player creation writes a starting event sharing the player's update instant", async () => {
    const playerId = await makePlayer();
    const player = await playerRow(playerId);
    const events = await eventsOf(playerId);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      isStarting: true,
      sourceTournamentId: null,
      rating: 1500,
      ratingDeviation: GLICKO2_CONSTANTS.DEFAULT_RD,
      publishedAt: player.ratingLastUpdateAt,
    });
  });

  test('closure publishes one outcome per player with completed rated games and nothing else', async () => {
    const [a, b, c, byeOnly] = await makePlayers({}, {}, {}, {});
    const byeBefore = await playerRow(byeOnly);
    const tournamentId = await makeRatedTournament(
      [a, b, c, byeOnly],
      [
        [0, 1, '1-0'],
        [2, 0, '1/2-1/2'],
      ],
    );
    const publishedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await publish(tournamentId, publishedAt);

    for (const playerId of [a, b, c]) {
      const events = await eventsOf(playerId);
      const player = await playerRow(playerId);
      expect(events).toHaveLength(2);
      expect(events.find((e) => !e.isStarting)).toMatchObject({
        sourceTournamentId: tournamentId,
        publishedAt,
        rating: player.rating,
        ratingDeviation: player.ratingDeviation,
      });
      expect(player.ratingLastUpdateAt).toEqual(publishedAt);
    }

    expect(await eventsOf(byeOnly)).toHaveLength(1);
    expect(await playerRow(byeOnly)).toEqual(byeBefore);
  });

  test("brings inactive participants' rd forward before rating, for both sides", async () => {
    // returning: rd 50 stored five years ago (grows to ~175); fresh: rd 150 now
    // control pair: winner rd 50 stored now, loser identical to `fresh`
    const [returning, fresh, ctrlWinner, ctrlLoser] = await makePlayers(
      { ratingDeviation: 50, lastUpdateWeeksAgo: 260 },
      { ratingDeviation: 150, lastUpdateWeeksAgo: 0 },
      { ratingDeviation: 50, lastUpdateWeeksAgo: 0 },
      { ratingDeviation: 150, lastUpdateWeeksAgo: 0 },
    );

    await publish(
      await makeRatedTournament([returning, fresh], [[0, 1, '1-0']]),
    );
    await publish(
      await makeRatedTournament([ctrlWinner, ctrlLoser], [[0, 1, '1-0']]),
    );

    const [ret, frs, ctrlL] = await Promise.all([
      playerRow(returning),
      playerRow(fresh),
      playerRow(ctrlLoser),
    ]);

    // the returning player's own uncertainty was inflated before the result
    expect(ret.ratingDeviation).toBeGreaterThan(frs.ratingDeviation);
    // and the fresh player saw that inflated rd across the board: losing to
    // an uncertain opponent costs less than losing to a certain one
    expect(frs.rating).toBeGreaterThan(ctrlL.rating);
  });

  test("merge deletes the duplicate's events and leaves the base timeline unchanged", async () => {
    const [base, duplicate, opp1, opp2] = await makePlayers({}, {}, {}, {});
    await publish(await makeRatedTournament([base, opp1], [[0, 1, '1-0']]));
    await publish(
      await makeRatedTournament([duplicate, opp2], [[0, 1, '0-1']]),
    );
    const baseBefore = await eventsOf(base);

    await mergePlayers({
      clubId,
      basePlayerId: base,
      mergedPlayerId: duplicate,
    });

    expect(await eventsOf(duplicate)).toHaveLength(0);
    expect(await eventsOf(base)).toEqual(baseBefore);
  });
});
