import { describe, expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';

import { AppError } from '@/lib/errors';
import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players, rating_events } from '@/server/db/schema/players';
import { fixtures } from '@/server/db/seed';
import { createPlayer } from '@/server/mutations/club-managing';
import { mergePlayers } from '@/server/mutations/player-merge';
import { calculateAndApplyGlickoRatings } from '@/server/mutations/rating-calculation';

const WEEK = GLICKO2_CONSTANTS.RATING_PERIOD_MS;

// player creation tests share one fixture club
const { clubId } = fixtures.clubs.next().value!;

const eventsOf = (playerId: string) =>
  db
    .select()
    .from(rating_events)
    .where(eq(rating_events.playerId, playerId))
    .orderBy(asc(rating_events.publishedAt), asc(rating_events.id));

const playerRow = async (playerId: string) =>
  (await db.select().from(players).where(eq(players.id, playerId)))[0];

const publish = (tournamentId: string, publishedAt = new Date()) =>
  db.transaction((tx) =>
    calculateAndApplyGlickoRatings(tournamentId, tx, publishedAt),
  );

describe('rating events', () => {
  test('creation keeps custom rating points but ignores caller uncertainty', async () => {
    const input = {
      nickname: `defaults ${newid()}`,
      rating: 1850,
      clubId,
      ratingDeviation: -10,
      ratingVolatility: 1,
      ratingLastUpdateAt: new Date(0),
    };
    const player = await createPlayer(input);
    expect(player).toMatchObject({
      rating: 1850,
      ratingDeviation: 350,
      ratingVolatility: 0.06,
    });
    expect(player.ratingLastUpdateAt.getTime()).toBeGreaterThan(0);
    expect((await eventsOf(player.id))[0]).toMatchObject({
      rating: 1850,
      ratingDeviation: 350,
    });
  });

  test('player and starting event roll back together in the caller transaction', async () => {
    let playerId = '';
    await expect(
      db.transaction(async (tx) => {
        const player = await createPlayer(
          { nickname: `rollback ${newid()}`, rating: 1500, clubId },
          { database: tx },
        );
        playerId = player.id;
        throw new AppError('PLAYER_NOT_CREATED');
      }),
    ).rejects.toMatchObject({ message: 'PLAYER_NOT_CREATED' });
    expect(await playerRow(playerId)).toBeUndefined();
    expect(await eventsOf(playerId)).toHaveLength(0);
  });
  test("player creation writes a starting event sharing the player's update instant", async () => {
    const player = await createPlayer({
      nickname: `starting ${newid()}`,
      rating: 1500,
      clubId,
    });
    const events = await eventsOf(player.id);

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
    const {
      tournamentId,
      playerIds: [a, b, c, d, byeOnly],
    } = fixtures.ready.next().value!;
    const byeBefore = await playerRow(byeOnly);
    const publishedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await publish(tournamentId, publishedAt);

    for (const playerId of [a, b, c, d]) {
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
    // white wins both games. returning: rd 50 stored five years ago (grows to
    // ~175); fresh: rd 150 now. control pair: winner rd 50 stored now, loser
    // identical to `fresh`
    const {
      tournamentId,
      playerIds: [returning, fresh, ctrlWinner, ctrlLoser],
    } = fixtures.ready.next().value!;
    for (const [playerId, ratingDeviation, weeksAgo] of [
      [returning, 50, 260],
      [fresh, 150, 0],
      [ctrlWinner, 50, 0],
      [ctrlLoser, 150, 0],
    ] as const) {
      await db
        .update(players)
        .set({
          ratingDeviation,
          ratingLastUpdateAt: new Date(Date.now() - weeksAgo * WEEK),
        })
        .where(eq(players.id, playerId));
    }

    await publish(tournamentId);

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
    // the sixth player shares no tournament with the first
    const {
      clubId,
      tournamentId,
      playerIds: [duplicate, , , , , base],
    } = fixtures.ready.next().value!;
    await publish(tournamentId);
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
