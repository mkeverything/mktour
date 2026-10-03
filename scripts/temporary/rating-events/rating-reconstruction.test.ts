import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { calculateLegacyRating } from './legacy-glicko2';
import { legacyOutcomeMayMatch } from './legacy-rating-bounds';
import {
  reconstructStartingRatings,
  legacyOutcomeEvents,
  ratingImportSql,
} from './reconstruct-starting-ratings';
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
  legacyOutcomeEventSchema,
  ratingEventImportSchema,
  startingReconstructionSchema,
  type LegacySnapshot,
} from './rating-reconstruction';

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

function jointFixture(ratings: number[]): LegacySnapshot {
  const base = fixture();
  const initial = ratings.map((rating) => ({
    rating,
    ratingDeviation: 350,
    ratingVolatility: 0.06,
  }));
  const games = ratings.flatMap((_, white) =>
    ratings.flatMap((_, black) =>
      black <= white
        ? []
        : [
            {
              ...base.games[0],
              id: `g${white}-${black}`,
              gameNumber: white * ratings.length + black,
              whitePlayerId: `p${white}`,
              blackPlayerId: `p${black}`,
              whiteUnitId: `u${white}`,
              blackUnitId: `u${black}`,
              result: (['1-0', '0-1', '1/2-1/2'] as const)[(white + black) % 3],
            },
          ],
    ),
  );
  const states = initial.map((player, i) =>
    calculateLegacyRating(
      player,
      games.flatMap((game) => {
        const white = game.whitePlayerId === `p${i}`;
        if (!white && game.blackPlayerId !== `p${i}`) return [];
        const opponent =
          initial[
            Number((white ? game.blackPlayerId : game.whitePlayerId).slice(1))
          ];
        return [
          {
            opponentRating: opponent.rating,
            opponentRatingDeviation: opponent.ratingDeviation,
            score:
              game.result === '1/2-1/2'
                ? (0.5 as const)
                : (game.result === '1-0') === white
                  ? (1 as const)
                  : (0 as const),
          },
        ];
      }),
      true,
    ),
  );
  return legacySnapshotSchema.parse({
    ...base,
    players: states.map((state, i) => ({
      ...base.players[0],
      ...state,
      id: `p${i}`,
      nickname: `player ${i}`,
    })),
    units: states.map((_, i) => ({
      ...base.units[0],
      id: `u${i}`,
      nickname: `player ${i}`,
      number: i + 1,
    })),
    participations: states.map((state, i) => ({
      ...base.participations[0],
      id: `ptu${i}`,
      playerId: `p${i}`,
      unitId: `u${i}`,
      newRating: state.rating,
      newRatingDeviation: state.ratingDeviation,
      newVolatility: state.ratingVolatility,
    })),
    games,
  });
}

describe('legacy starting reconstruction', () => {
  test('interval pruning never excludes a real legacy calculation', () => {
    for (let seed = 0; seed < 120; seed++) {
      const player = {
        rating: 400 + ((seed * 137) % 2601),
        ratingDeviation: [30, 60, 200, 350][(seed + Math.floor(seed / 4)) % 4],
        ratingVolatility: [0.001, 0.06, 0.5][seed % 3],
      };
      const results = Array.from({ length: seed % 4 }, (_, i) => ({
        opponentRating: (seed * 173 + i * 397) % 3001,
        opponentRatingDeviation: [30, 200, 350][(seed + i) % 3],
        score: ([0, 0.5, 1] as const)[(seed + i) % 3],
      }));
      const bounded = seed % 2 === 0;
      const outcome = calculateLegacyRating(player, results, bounded);
      expect(
        legacyOutcomeMayMatch(
          player,
          results.map((result) => ({
            ...result,
            ratings: [
              Math.max(0, result.opponentRating - 300),
              result.opponentRating,
              Math.min(3000, result.opponentRating + 300),
            ],
          })),
          outcome,
          bounded,
        ),
      ).toBe(true);
    }
  });

  test('rejects impossible rd bounds without enumerating opponents', () => {
    expect(
      legacyOutcomeMayMatch(
        { rating: 1500, ratingDeviation: 350, ratingVolatility: 0.06 },
        [{ ratings: [0, 1500, 3000], opponentRatingDeviation: 350, score: 1 }],
        { rating: 1500, ratingDeviation: 50, ratingVolatility: 0.06 },
        true,
      ),
    ).toBe(false);
  });

  test('uniquely recovers a coupled first-tournament group within the standard search budget', () => {
    const ratings = Array.from({ length: 6 }, (_, i) => 1200 + i * 50);
    const snapshot = jointFixture(ratings);
    const before = structuredClone(snapshot);
    const result = reconstructStartingRatings(snapshot, -Infinity);
    expect(result.every((entry) => entry.status === 'recovered')).toBe(true);
    expect(result.map((entry) => entry.event?.rating)).toEqual(ratings);
    expect(snapshot).toEqual(before);
  });

  test('covers a large group even when uniqueness cannot be proved within the budget', () => {
    const snapshot = jointFixture(
      Array.from({ length: 14 }, (_, i) => 1200 + i * 50),
    );
    const result = reconstructStartingRatings(snapshot, -Infinity, 5000);
    expect(result).toHaveLength(snapshot.players.length);
    expect(
      result.every(
        (entry) =>
          entry.status === 'estimated' &&
          entry.estimate?.method === 'inverse-first-outcome' &&
          entry.event !== null,
      ),
    ).toBe(true);
    expect(
      result.every((entry) =>
        entry.reasons.some((reason) => reason.includes('uniqueness unproven')),
      ),
    ).toBe(true);
  });

  test('does not reject matching values because the old client clock was ahead', () => {
    const snapshot = fixture();
    snapshot.players.forEach((player) => {
      player.ratingLastUpdateAt = new Date(
        player.ratingLastUpdateAt.getTime() - 89_000,
      );
    });
    expect(
      reconstructStartingRatings(snapshot, -Infinity).map(
        (entry) => entry.status,
      ),
    ).toEqual(['recovered', 'recovered']);
  });

  test('covers erased reset histories with explicit defaults, not current ratings', () => {
    const snapshot = fixture();
    snapshot.tournaments[0].closedAt = null;
    snapshot.tournaments[0].startedAt = null;
    snapshot.games = [];
    const before = structuredClone(snapshot);
    const result = reconstructStartingRatings(snapshot, -Infinity);
    expect(
      result.every(
        (entry) =>
          entry.status === 'estimated' &&
          entry.event?.rating === 1500 &&
          entry.event.ratingDeviation === 350 &&
          entry.estimate?.method === 'default',
      ),
    ).toBe(true);
    expect(
      result.every((entry) =>
        entry.reasons.some((reason) => reason.includes('open/reset')),
      ),
    ).toBe(true);
    expect(snapshot).toEqual(before);
    expect(startingReconstructionSchema.array().safeParse(result).success).toBe(
      true,
    );
    const sql = ratingImportSql(
      result.map((entry) => entry.event!),
      new Set(result.map((entry) => entry.id)),
    );
    expect([...sql.matchAll(/-- estimated starting rating;/g)]).toHaveLength(2);
  });

  test('covers merged histories without recreating intentionally discarded outcomes', () => {
    const snapshot = fixture();
    Object.assign(snapshot.participations[0], {
      newRating: null,
      newRatingDeviation: null,
      newVolatility: null,
    });
    const before = structuredClone(snapshot);
    const result = reconstructStartingRatings(snapshot, -Infinity);
    expect(
      result.every(
        (entry) => entry.event !== null && entry.status === 'estimated',
      ),
    ).toBe(true);
    expect(result[0].estimate?.method).toBe('default');
    expect(
      result[1].reasons.some((reason) =>
        reason.includes('missing participant/opponent snapshots'),
      ),
    ).toBe(true);
    expect(legacyOutcomeEvents(snapshot)).toHaveLength(1);
    expect(startingReconstructionSchema.array().safeParse(result).success).toBe(
      true,
    );
    expect(snapshot).toEqual(before);
  });

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

  test('labels fallbacks for contradictions, missing snapshots and search limits as estimates', () => {
    const contradictory = fixture();
    contradictory.players[0].rating++;
    const estimates = reconstructStartingRatings(contradictory, -Infinity);
    expect(
      estimates.every(
        (entry) => entry.status === 'estimated' && entry.estimate !== null,
      ),
    ).toBe(true);
    expect(estimates.map((entry) => entry.event?.rating)).toEqual([1400, 1500]);
    expect(estimates[0].estimate).toMatchObject({
      method: 'inverse-first-outcome',
      ratingError: 0,
      ratingDeviationError: 0,
    });
    expect(estimates[0].reasons).toContain(
      'latest snapshot disagrees with the stored baseline',
    );
    const missing = fixture();
    missing.participations[0].newVolatility = null;
    expect(
      reconstructStartingRatings(missing, -Infinity).every(
        (entry) => entry.status === 'estimated' && entry.estimate !== null,
      ),
    ).toBe(true);
    const limited = reconstructStartingRatings(fixture(), -Infinity, 1);
    expect(
      limited.every(
        (entry) =>
          entry.status === 'estimated' &&
          entry.event !== null &&
          entry.reasons.some((reason) =>
            reason.includes('uniqueness unproven'),
          ),
      ),
    ).toBe(true);
  });

  test('exports outcomes unchanged even when starts are estimated or the tournament is now unrated', () => {
    const snapshot = fixture();
    snapshot.players[0].rating++;
    snapshot.tournaments[0].rated = false;
    expect(
      reconstructStartingRatings(snapshot, -Infinity).every(
        (entry) => entry.status === 'estimated',
      ),
    ).toBe(true);
    expect(legacyOutcomeEvents(snapshot)).toHaveLength(2);
    snapshot.tournaments[0].closedAt = null;
    expect(legacyOutcomeEvents(snapshot)).toHaveLength(0);
  });

  test.each([
    [0, 400],
    [399, 400],
    [400, 400],
    [1500, 1500],
    [3400, 3400],
    [3401, 3400],
  ])(
    'exports historical rating %i as %i without changing its source',
    (originalRating, rating) => {
      const snapshot = fixture();
      snapshot.participations[0].newRating = originalRating;
      const before = structuredClone(snapshot);
      expect(legacyOutcomeEvents(snapshot)[0]).toMatchObject({
        playerId: 'p0',
        sourceTournamentId: 'tournament',
        originalRating,
        rating,
      });
      expect(snapshot).toEqual(before);
    },
  );

  test.each([399, 3401, 400.5, NaN, Infinity])(
    'rejects invalid rating %s at the import boundary',
    (rating) => {
      const event = { ...legacyOutcomeEvents(fixture())[0], rating };
      expect(ratingEventImportSchema.safeParse(event).success).toBe(false);
      expect(() => ratingImportSql([event])).toThrow();
    },
  );

  test.each([400.5, NaN, Infinity, -Infinity])(
    'rejects malformed historical rating %s rather than clamping it',
    (rating) => {
      const snapshot = fixture();
      snapshot.participations[0].newRating = rating;
      expect(() => legacyOutcomeEvents(snapshot)).toThrow();
    },
  );

  test('stops export on incomplete or duplicate outcome data before migration', () => {
    const incomplete = fixture();
    incomplete.participations[0].newRatingDeviation = null;
    expect(() => legacyOutcomeEvents(incomplete)).toThrow();
    const duplicate = fixture();
    duplicate.participations.push({
      ...duplicate.participations[0],
      id: 'duplicate',
    });
    expect(() => legacyOutcomeEvents(duplicate)).toThrow();
  });

  test('does not label tied closures as exact by ordering ids', () => {
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
    expect(result[0].status).toBe('estimated');
    expect(
      result[0].reasons.some((reason) => reason.includes('tied closures')),
    ).toBe(true);
  });

  test.each([false, true])(
    'exports before migration and imports idempotently after all legacy columns are dropped (out-of-range: %s)',
    async (outOfRange) => {
      const client = createClient({ url: 'file::memory:' });
      try {
        const migrations = readMigrationFiles({
          migrationsFolder: 'src/server/db/migrations',
        });
        const boundary = migrations.findIndex((migration) =>
          migration.sql.some((statement) =>
            statement.includes('CREATE TABLE `rating_event`'),
          ),
        );
        expect(boundary).toBeGreaterThan(0);
        await client.migrate(
          migrations.slice(0, boundary).flatMap((migration) => migration.sql),
        );
        const database = drizzle({ client });
        const snapshot = fixture();
        if (outOfRange) {
          snapshot.participations[0].newRating = 399;
          snapshot.participations[1].newRating = 3401;
        }
        const expectedRecovered = outOfRange ? 0 : 2;
        await database
          .insert(clubs)
          .values({ id: 'club', name: 'club', createdAt: new Date() });
        await database.insert(players).values(snapshot.players);
        await database.insert(tournaments).values(snapshot.tournaments);
        await database.insert(tournament_units).values(snapshot.units);
        await database.insert(players_to_units).values(snapshot.participations);
        await database.insert(games).values(snapshot.games);
        // emulate historical rows that predate enforcement of the legacy bounds.
        if (outOfRange)
          await client.execute('PRAGMA ignore_check_constraints = ON');
        for (const p of snapshot.participations)
          await client.execute({
            sql: 'UPDATE players_to_units SET new_rating = ?, new_rating_deviation = ?, new_volatility = ? WHERE id = ?',
            args: [p.newRating, p.newRatingDeviation, p.newVolatility, p.id],
          });
        if (outOfRange)
          await client.execute('PRAGMA ignore_check_constraints = OFF');
        const before = await database.select().from(players);
        const members = await database.select().from(players_to_units);
        const directory = mkdtempSync(join(tmpdir(), 'mktour-export-test-'));
        let exported: string;
        try {
          const input = join(directory, 'wal snapshot #1.db');
          const prefix = join(directory, 'report');
          await client.execute({ sql: 'VACUUM INTO ?', args: [input] });
          const walDatabase = new Database(input);
          walDatabase.exec('PRAGMA journal_mode=WAL');
          walDatabase.close();
          const fingerprint = Bun.hash(await Bun.file(input).bytes());
          const process = Bun.spawn(
            [
              Bun.which('bun')!,
              'scripts/temporary/rating-events/reconstruct-starting-ratings.ts',
              input,
              prefix,
              'always',
            ],
            { stdout: 'pipe', stderr: 'pipe' },
          );
          const stderr = await new Response(process.stderr).text();
          expect({ code: await process.exited, stderr }).toEqual({
            code: outOfRange ? 2 : 0,
            stderr: '',
          });
          const report = await Bun.file(`${prefix}.json`).json();
          expect(report.counts).toMatchObject({
            outcomes: 2,
            clampedOutcomes: outOfRange ? 2 : 0,
            recovered: expectedRecovered,
            estimated: 2 - expectedRecovered,
            skipped: 0,
          });
          const reportOutcomes = legacyOutcomeEventSchema
            .omit({ publishedAt: true })
            .array()
            .parse(report.outcomes);
          expect(reportOutcomes.map((event) => event.originalRating)).toEqual(
            snapshot.participations.map((p) => p.newRating!),
          );
          expect(reportOutcomes.map((event) => event.rating)).toEqual(
            outOfRange
              ? [400, 3400]
              : snapshot.participations.map((p) => p.newRating!),
          );
          exported = await Bun.file(`${prefix}.sql`).text();
          expect(Bun.hash(await Bun.file(input).bytes())).toBe(fingerprint);
          expect(await Bun.file(`${input}-wal`).exists()).toBe(false);
        } finally {
          rmSync(directory, { recursive: true });
        }
        const outcomes = legacyOutcomeEvents(snapshot);
        expect(exported).not.toContain('players_to_units');
        await client.migrate(
          migrations.slice(boundary).flatMap((migration) => migration.sql),
        );
        expect(
          (
            await client.execute('PRAGMA table_info(players_to_units)')
          ).rows.map((column) => column.name),
        ).toEqual(['id', 'player_id', 'unit_id', 'number_in_unit']);
        await client.executeMultiple(exported);
        const firstImport = await client.execute('SELECT * FROM rating_event');
        await client.executeMultiple(exported);
        const events = await client.execute('SELECT * FROM rating_event');
        expect(events.rows).toHaveLength(4);
        const starts = events.rows.filter((event) => event.is_starting === 1);
        expect(starts).toHaveLength(snapshot.players.length);
        if (outOfRange) {
          expect(
            starts.every(
              (event) =>
                Number(event.rating) >= 400 && Number(event.rating) <= 3000,
            ),
          ).toBe(true);
          expect(exported).toContain('-- estimated starting rating;');
        } else {
          expect(starts.map((event) => event.rating).sort()).toEqual([
            1400, 1500,
          ]);
        }
        expect(events.rows).toEqual(firstImport.rows);
        for (const outcome of outcomes) {
          expect(
            events.rows.find(
              (event) =>
                event.player_id === outcome.playerId && event.is_starting === 0,
            ),
          ).toMatchObject({
            source_tournament_id: outcome.sourceTournamentId,
            rating: outcome.rating,
            rating_deviation: outcome.ratingDeviation,
            published_at: outcome.publishedAt.getTime() / 1000,
          });
        }
        expect(await database.select().from(players)).toEqual(before);
        expect(await database.select().from(players_to_units)).toEqual(members);
        expect(
          (await client.execute('PRAGMA foreign_key_check')).rows,
        ).toHaveLength(0);
        expect(
          (
            await client.execute('PRAGMA table_info(players_to_units)')
          ).rows.map((column) => column.name),
        ).toEqual(['id', 'player_id', 'unit_id', 'number_in_unit']);
        expect(
          (await client.execute('SELECT * FROM rating_event')).rows,
        ).toEqual(events.rows);
      } finally {
        client.close();
      }
    },
  );
});
