import { describe, expect, test } from 'bun:test';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { calculateLegacyRating } from '../../scripts/temporary/rating-events/legacy-glicko2';
import {
  reconstructStartingRatings,
  startingImportSql,
} from '../../scripts/temporary/rating-events/reconstruct-starting-ratings';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import {
  legacySnapshotSchema,
  type LegacySnapshot,
} from '@/server/zod/rating-reconstruction';

function fixture(): LegacySnapshot {
  const at = new Date('2026-06-01T12:00:00Z');
  const initial = [1400, 1500].map((rating) => ({
    rating,
    ratingDeviation: 350,
    ratingVolatility: 0.06,
  }));
  const states = initial.map((player, i) =>
    calculateLegacyRating(
      player,
      [
        {
          opponentRating: initial[1 - i].rating,
          opponentRatingDeviation: 350,
          score: 0.5,
        },
      ],
      true,
    ),
  );
  return legacySnapshotSchema.parse({
    players: states.map((state, i) => ({
      ...state,
      id: `p${i}`,
      nickname: `player ${i}`,
      clubId: 'club',
      realname: null,
      userId: null,
      ratingPeak: null,
      ratingLastUpdateAt: at,
      lastSeenAt: at,
    })),
    tournaments: [
      {
        id: 'tournament',
        title: 'historical tournament',
        clubId: 'club',
        format: 'round robin',
        type: 'solo',
        date: '2026-06-01',
        createdAt: at,
        startedAt: at,
        closedAt: at,
        rated: true,
        roundsNumber: 1,
        ongoingRound: 1,
      },
    ],
    units: states.map((_, i) => ({
      id: `u${i}`,
      tournamentId: 'tournament',
      nickname: `player ${i}`,
      size: 1,
      wins: 0,
      losses: 0,
      draws: 1,
      colorIndex: 0,
      place: 1,
      isOut: null,
      number: i + 1,
      addedAt: at,
    })),
    participations: states.map((state, i) => ({
      id: `ptu${i}`,
      playerId: `p${i}`,
      unitId: `u${i}`,
      numberInUnit: 1,
      newRating: state.rating,
      newRatingDeviation: state.ratingDeviation,
      newVolatility: state.ratingVolatility,
    })),
    games: [
      {
        id: 'game',
        tournamentId: 'tournament',
        gameNumber: 1,
        roundNumber: 1,
        roundName: null,
        whiteUnitId: 'u0',
        blackUnitId: 'u1',
        whitePlayerId: 'p0',
        blackPlayerId: 'p1',
        whitePrevGameId: null,
        blackPrevGameId: null,
        result: '1/2-1/2',
        finishedAt: at,
      },
    ],
  });
}

describe('legacy starting reconstruction', () => {
  test('preserves the published glicko-2 reference result and integer rd rounding', () => {
    const result = calculateLegacyRating(
      { rating: 1500, ratingDeviation: 200, ratingVolatility: 0.06 },
      [
        { opponentRating: 1400, opponentRatingDeviation: 30, score: 1 },
        { opponentRating: 1550, opponentRatingDeviation: 100, score: 0 },
        { opponentRating: 1700, opponentRatingDeviation: 300, score: 0 },
      ],
      true,
    );
    expect(result.rating).toBe(1464);
    expect(result.ratingDeviation).toBe(152);
    expect(result.ratingVolatility).toBeCloseTo(0.059996, 5);
    expect(
      calculateLegacyRating(
        { rating: 1500, ratingDeviation: 60, ratingVolatility: 0.06 },
        [],
        true,
      ).ratingDeviation,
    ).toBe(61);
  });

  test('uniquely solves both unknown opponents on the historical slider grid', () => {
    const snapshot = fixture();
    const before = structuredClone(snapshot);
    const result = reconstructStartingRatings(snapshot, -Infinity);
    expect(result.map((p) => p.status)).toEqual(['recovered', 'recovered']);
    expect(result.map((p) => p.candidates)).toEqual([[1400], [1500]]);
    expect(result[0].event?.publishedAt.getTime()).toBe(
      snapshot.tournaments[0].closedAt!.getTime() - 1000,
    );
    expect(snapshot).toEqual(before);
  });

  test('uses an unchanged stored baseline for players without history', () => {
    const snapshot = fixture();
    snapshot.players = [
      {
        ...snapshot.players[0],
        rating: 1850,
        ratingDeviation: 350,
        ratingVolatility: 0.06,
      },
    ];
    snapshot.tournaments = [];
    snapshot.units = [];
    snapshot.games = [];
    snapshot.participations = [];
    const [result] = reconstructStartingRatings(snapshot, -Infinity);
    expect(result.status).toBe('direct-baseline');
    expect(result.event).toMatchObject({
      rating: 1850,
      publishedAt: snapshot.players[0].ratingLastUpdateAt,
    });
  });

  test('reports contradictions, missing snapshots and search limits rather than guessing', () => {
    const contradictory = fixture();
    contradictory.players[0].rating++;
    expect(
      reconstructStartingRatings(contradictory, -Infinity).every(
        (p) => p.status === 'skipped',
      ),
    ).toBe(true);
    const missing = fixture();
    missing.participations[0].newVolatility = null;
    expect(
      reconstructStartingRatings(missing, -Infinity).every(
        (p) => p.status === 'skipped',
      ),
    ).toBe(true);
    const limited = reconstructStartingRatings(fixture(), -Infinity, 1);
    expect(
      limited.every(
        (p) =>
          p.event === null &&
          p.reasons.some((reason) => reason.includes('uniqueness unproven')),
      ),
    ).toBe(true);
  });

  test('does not infer chronological order from ids when closures tie', () => {
    const snapshot = fixture();
    snapshot.tournaments.push({ ...snapshot.tournaments[0], id: 'tied' });
    snapshot.units.push({
      ...snapshot.units[0],
      id: 'tied-unit',
      tournamentId: 'tied',
    });
    snapshot.participations.push({
      ...snapshot.participations[0],
      id: 'tied-ptu',
      unitId: 'tied-unit',
    });
    const result = reconstructStartingRatings(snapshot, -Infinity);
    expect(result[0].status).toBe('skipped');
    expect(
      result[0].reasons.some((reason) => reason.includes('tied closures')),
    ).toBe(true);
  });

  test('manual imports are idempotent; generated cleanup preserves players and memberships', async () => {
    const client = createClient({ url: 'file::memory:' });
    try {
      const migrations = readMigrationFiles({
        migrationsFolder: 'src/server/db/migrations',
      });
      await client.migrate(
        migrations.slice(0, -1).flatMap((migration) => migration.sql),
      );
      const database = drizzle(client);
      const snapshot = fixture();
      await database
        .insert(clubs)
        .values({ id: 'club', name: 'club', createdAt: new Date() });
      await database.insert(players).values(snapshot.players);
      await database.insert(tournaments).values(snapshot.tournaments);
      await database.insert(tournament_units).values(snapshot.units);
      await database.insert(players_to_units).values(snapshot.participations);
      await database.insert(games).values(snapshot.games);
      for (const p of snapshot.participations)
        await client.execute({
          sql: 'UPDATE players_to_units SET new_rating = ?, new_rating_deviation = ?, new_volatility = ? WHERE id = ?',
          args: [p.newRating, p.newRatingDeviation, p.newVolatility, p.id],
        });
      const before = await database.select().from(players);
      const members = await database.select().from(players_to_units);
      const backfill = await Bun.file(
        'scripts/temporary/rating-events/backfill-rating-events.sql',
      ).text();
      await client.executeMultiple(backfill);
      await client.executeMultiple(backfill);
      const starts = startingImportSql(
        reconstructStartingRatings(snapshot, -Infinity),
      );
      await client.executeMultiple(starts);
      await client.executeMultiple(starts);
      const events = await client.execute('SELECT * FROM rating_event');
      expect(events.rows).toHaveLength(4);
      expect(
        events.rows
          .filter((e) => e.is_starting === 1)
          .map((e) => e.rating)
          .sort(),
      ).toEqual([1400, 1500]);
      await client.migrate(migrations.at(-1)!.sql);
      expect(await database.select().from(players)).toEqual(before);
      expect(await database.select().from(players_to_units)).toEqual(members);
      expect(
        (await client.execute('PRAGMA foreign_key_check')).rows,
      ).toHaveLength(0);
      expect(
        (await client.execute('PRAGMA table_info(players_to_units)')).rows.map(
          (column) => column.name,
        ),
      ).toEqual(['id', 'player_id', 'unit_id', 'number_in_unit']);
      expect((await client.execute('SELECT * FROM rating_event')).rows).toEqual(
        events.rows,
      );
    } finally {
      client.close();
    }
  });
});
