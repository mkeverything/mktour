/*
read-only, local-only history export. never pass a live database or production url.
follow README.md: freeze/export first, review, migrate, then import and verify.
keep all writes paused throughout; do not invoke the migration endpoint before review.

run from the repository root, with bun:
  bun scripts/temporary/rating-events/reconstruct-starting-ratings.ts \
    /absolute/frozen.sqlite /absolute/report-prefix <rating-bounds-since>

rating-bounds-since is the verified deployment instant of 477e9a32 (iso timestamp),
"always" if it predates every closure, or "never" if all closures predate it.
git author dates are NOT deployment dates. stop if you cannot verify this assumption.
the slider previously allowed 0–3000, step 50; 477e9a32 narrowed it to 800–2200.
without player creation dates, search the full historical grid to avoid false uniqueness.

use a consistent standalone sqlite export, not a copied live main file without its wal.
the tool opens it readonly, reads only domain tables in one transaction, and never
connects to turso or imports application database credentials. output files must not exist.

first run the synthetic tests:
  bun test:noseed src/tests/rating-reconstruction.test.ts
then rehearse export -> review -> all pending migrations -> import -> verification
on a db copy. the .json report and .sql contain both legacy tournament outcomes and
validated starting events; a skipped starting event never removes a legacy outcome.
review assumptions, every outcome, skipped player, candidate list and reason.
exit 2 means some starts were skipped, NOT full success. search limits and
contradictory histories are deliberately unresolved, never guessed.

only after review, invoke the existing secure migration endpoint once, then manually
apply the approved .sql in one turso shell connection with stop-on-error. the inserts
need only rating_event, not the retired ptu columns. on error ROLLBACK and investigate.
verify exact imported values against the saved report, unchanged players/memberships
against the export, and foreign keys before reopening writes. see README.md for rollback.
*/
import { Database, constants } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getTableColumns, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { AppError } from '@/lib/errors';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import {
  legacySnapshotSchema,
  ratingEventImportSchema,
  type RatingEventImport,
  type LegacyRatingState,
  type LegacyResult,
  type LegacySnapshot,
  type StartingReconstruction,
} from '@/server/zod/rating-reconstruction';
import { calculateLegacyRating } from './legacy-glicko2';

const STARTING_GRID = Array.from({ length: 61 }, (_, i) => i * 50);
const sameVolatility = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
const sameState = (a: LegacyRatingState, b: LegacyRatingState) =>
  a.rating === b.rating &&
  a.ratingDeviation === b.ratingDeviation &&
  sameVolatility(a.ratingVolatility, b.ratingVolatility);

export function reconstructStartingRatings(
  snapshot: LegacySnapshot,
  boundsSince: number,
  maxNodes = 500_000,
): StartingReconstruction[] {
  const tournamentById = new Map(snapshot.tournaments.map((t) => [t.id, t]));
  const unitById = new Map(snapshot.units.map((u) => [u.id, u]));
  const records = new Map(snapshot.players.map((p) => [p.id, p]));
  const cases = new Map(
    snapshot.players.map((p): [string, StartingReconstruction] => [
      p.id,
      {
        id: p.id,
        clubId: p.clubId,
        status: 'skipped',
        candidates: [],
        reasons: [],
        event: null,
      },
    ]),
  );
  const outcomes = snapshot.participations.flatMap((p) => {
    const unit = unitById.get(p.unitId);
    const tournament = unit && tournamentById.get(unit.tournamentId);
    if (!tournament?.closedAt || p.newRating === null) return [];
    return [
      {
        ...p,
        tournament,
        at: tournament.closedAt.getTime(),
        state: {
          rating: p.newRating,
          ratingDeviation: p.newRatingDeviation ?? NaN,
          ratingVolatility: p.newVolatility ?? NaN,
        },
      },
    ];
  });
  const histories = new Map(
    snapshot.players.map((p) => [
      p.id,
      outcomes.filter((o) => o.playerId === p.id).sort((a, b) => a.at - b.at),
    ]),
  );
  const reject = (id: string, reason: string) => {
    const entry = cases.get(id);
    if (entry && !entry.reasons.includes(reason)) entry.reasons.push(reason);
  };
  for (const player of snapshot.players) {
    const history = histories.get(player.id)!;
    const latest = history.at(-1);
    if (
      latest &&
      (!sameState(player, latest.state) ||
        player.ratingLastUpdateAt.getTime() < latest.at)
    ) {
      reject(
        player.id,
        'latest snapshot disagrees with the stored baseline or its update timestamp',
      );
    }
    for (let i = 0; i < history.length; i++) {
      const outcome = history[i];
      if (
        !Number.isFinite(outcome.state.ratingVolatility) ||
        outcome.state.ratingVolatility <= 0 ||
        !(
          outcome.state.ratingDeviation >= 30 &&
          outcome.state.ratingDeviation <= 350
        )
      ) {
        reject(
          player.id,
          `missing or invalid uncertainty snapshot: ${outcome.tournament.id}`,
        );
      }
      if (history[i - 1]?.at === outcome.at)
        reject(
          player.id,
          'tied closures or duplicate participation; ordering is not recoverable',
        );
      if (
        !outcome.tournament.startedAt ||
        outcome.tournament.startedAt.getTime() > outcome.at
      ) {
        reject(
          player.id,
          `closure predates start or has no start: ${outcome.tournament.id}`,
        );
      }
      if (!outcome.tournament.rated)
        reject(
          player.id,
          `snapshot on an unrated tournament: ${outcome.tournament.id}`,
        );
    }
    for (const participation of snapshot.participations.filter(
      (p) => p.playerId === player.id,
    )) {
      const unit = unitById.get(participation.unitId);
      const tournament = unit && tournamentById.get(unit.tournamentId);
      if (!tournament) {
        reject(player.id, 'missing tournament/unit');
        continue;
      }
      if (!tournament.closedAt && participation.newRating !== null)
        reject(player.id, 'open/reset tournament retains a rating snapshot');
      if (
        tournament.closedAt &&
        tournament.rated &&
        participation.newRating === null &&
        snapshot.games.some(
          (g) =>
            g.tournamentId === tournament.id &&
            g.result &&
            g.whitePlayerId &&
            g.blackPlayerId,
        )
      ) {
        reject(player.id, `missing historical publication: ${tournament.id}`);
      }
    }
    if (!latest) {
      if (
        !STARTING_GRID.includes(player.rating) ||
        player.ratingDeviation !== 350 ||
        !sameVolatility(player.ratingVolatility, 0.06)
      ) {
        reject(
          player.id,
          'no snapshots but baseline contradicts normal ui starting values',
        );
      }
      const entry = cases.get(player.id)!;
      entry.candidates = [player.rating];
      if (
        !entry.reasons.length &&
        player.rating >= 400 &&
        player.rating <= 3400
      ) {
        entry.status = 'direct-baseline';
        entry.event = {
          playerId: player.id,
          sourceTournamentId: null,
          isStarting: true,
          publishedAt: player.ratingLastUpdateAt,
          rating: player.rating,
          ratingDeviation: player.ratingDeviation,
        };
      } else if (!entry.reasons.length)
        reject(
          player.id,
          'historical starting rating is outside event bounds; do not clamp it',
        );
    }
  }

  type Constraint = {
    dependencies: string[];
    check: (ratings: Map<string, number>) => boolean;
  };
  const constraints: Constraint[] = [];
  for (const outcome of outcomes) {
    if (!records.has(outcome.playerId)) continue;
    const tournamentGames = snapshot.games.filter(
      (g) => g.tournamentId === outcome.tournament.id,
    );
    const realGames = tournamentGames.filter(
      (g) => g.whitePlayerId && g.blackPlayerId && g.result,
    );
    if (!realGames.length || tournamentGames.some((g) => g.result === null)) {
      reject(
        outcome.playerId,
        `snapshot without complete games: ${outcome.tournament.id}`,
      );
      continue;
    }
    const ownGames = realGames.filter(
      (g) =>
        g.whitePlayerId === outcome.playerId ||
        g.blackPlayerId === outcome.playerId,
    );
    const ids = [
      ...new Set([
        outcome.playerId,
        ...ownGames.map(
          (g) =>
            (g.whitePlayerId === outcome.playerId
              ? g.blackPlayerId
              : g.whitePlayerId)!,
        ),
      ]),
    ];
    const prior = new Map(
      ids.map((id) => [
        id,
        histories
          .get(id)
          ?.filter((o) => o.at < outcome.at)
          .at(-1)?.state,
      ]),
    );
    const dependencies = ids.filter(
      (id) => !prior.get(id) && histories.get(id)?.length,
    );
    const missing = ids.filter(
      (id) =>
        !records.has(id) ||
        !outcomes.some(
          (o) => o.playerId === id && o.tournament.id === outcome.tournament.id,
        ),
    );
    if (missing.length) {
      for (const id of [outcome.playerId, ...dependencies])
        reject(
          id,
          `missing participant/opponent snapshots: ${outcome.tournament.id}`,
        );
      continue;
    }
    const check = (ratings: Map<string, number>) => {
      const state = (id: string): LegacyRatingState =>
        prior.get(id) ?? {
          rating: ratings.get(id) ?? records.get(id)!.rating,
          ratingDeviation: 350,
          ratingVolatility: 0.06,
        };
      const results: LegacyResult[] = ownGames.map((game) => {
        const white = game.whitePlayerId === outcome.playerId;
        const opponent = state(
          (white ? game.blackPlayerId : game.whitePlayerId)!,
        );
        return {
          opponentRating: opponent.rating,
          opponentRatingDeviation: opponent.ratingDeviation,
          score:
            game.result === '1/2-1/2'
              ? 0.5
              : (game.result === '1-0') === white
                ? 1
                : 0,
        };
      });
      return sameState(
        calculateLegacyRating(
          state(outcome.playerId),
          results,
          outcome.at >= boundsSince,
        ),
        outcome.state,
      );
    };
    if (!dependencies.length) {
      if (!check(new Map()))
        reject(
          outcome.playerId,
          `historical forward calculation/closure order disagrees: ${outcome.tournament.id}`,
        );
    } else constraints.push({ dependencies, check });
  }

  const remaining = new Set(
    snapshot.players
      .filter((p) => histories.get(p.id)!.length)
      .map((p) => p.id),
  );
  while (remaining.size) {
    const component = new Set([remaining.values().next().value!]);
    let size = 0;
    while (size !== component.size) {
      size = component.size;
      for (const constraint of constraints) {
        if (constraint.dependencies.some((id) => component.has(id))) {
          for (const id of constraint.dependencies) component.add(id);
        }
      }
    }
    for (const id of component) remaining.delete(id);
    const relevant = constraints.filter((c) =>
      c.dependencies.some((id) => component.has(id)),
    );
    if ([...component].some((id) => cases.get(id)!.reasons.length)) {
      for (const id of component)
        reject(
          id,
          'joint reconstruction depends on contradictory/incomplete history',
        );
      continue;
    }
    const ids = [...component].sort(
      (a, b) =>
        relevant.filter((c) => c.dependencies.includes(b)).length -
        relevant.filter((c) => c.dependencies.includes(a)).length,
    );
    const assignment = new Map<string, number>();
    const candidates = new Map(ids.map((id) => [id, new Set<number>()]));
    let nodes = 0;
    let exhausted = false;
    let ambiguous = false;
    const search = (depth: number) => {
      if (exhausted || ambiguous) return;
      if (++nodes > maxNodes) {
        exhausted = true;
        return;
      }
      if (
        relevant.some(
          (c) =>
            c.dependencies.every((id) => assignment.has(id)) &&
            !c.check(assignment),
        )
      )
        return;
      if (depth === ids.length) {
        for (const id of ids) candidates.get(id)!.add(assignment.get(id)!);
        ambiguous = ids.every((id) => candidates.get(id)!.size > 1);
        return;
      }
      for (const rating of STARTING_GRID) {
        assignment.set(ids[depth], rating);
        search(depth + 1);
        if (exhausted || ambiguous) break;
      }
      assignment.delete(ids[depth]);
    };
    search(0);
    for (const id of ids) {
      const entry = cases.get(id)!;
      entry.candidates = [...candidates.get(id)!].sort((a, b) => a - b);
      if (exhausted)
        reject(
          id,
          `joint search exceeded ${maxNodes} nodes; candidates are partial, uniqueness unproven`,
        );
      else if (ambiguous || entry.candidates.length > 1)
        reject(
          id,
          'multiple validated joint solutions; candidate list may be partial',
        );
      else if (!entry.candidates.length)
        reject(
          id,
          'no historical-grid assignment matches every surviving snapshot',
        );
      else {
        const rating = entry.candidates[0];
        if (rating < 400 || rating > 3400)
          reject(
            id,
            'unique historical start is outside event bounds; do not clamp it',
          );
        else {
          entry.status = 'recovered';
          entry.event = {
            playerId: id,
            sourceTournamentId: null,
            isStarting: true,
            publishedAt: new Date(histories.get(id)![0].at - 1000),
            rating,
            ratingDeviation: 350,
          };
        }
      }
    }
  }
  return [...cases.values()];
}

export function legacyOutcomeEvents(
  snapshot: LegacySnapshot,
): RatingEventImport[] {
  const units = new Map(snapshot.units.map((unit) => [unit.id, unit]));
  const tournaments = new Map(
    snapshot.tournaments.map((tournament) => [tournament.id, tournament]),
  );
  const seen = new Set<string>();
  return snapshot.participations.flatMap((participation) => {
    if (participation.newRating === null) return [];
    const unit = units.get(participation.unitId);
    const tournament = unit && tournaments.get(unit.tournamentId);
    if (!tournament)
      throw new AppError('CONFIG_ERROR', {
        cause: `missing tournament for legacy snapshot ${participation.id}`,
      });
    if (!tournament.closedAt) return [];
    const key = JSON.stringify([participation.playerId, tournament.id]);
    if (seen.has(key))
      throw new AppError('CONFIG_ERROR', {
        cause: `duplicate legacy outcome ${key}; stop before migration`,
      });
    seen.add(key);
    return [
      ratingEventImportSchema.parse({
        playerId: participation.playerId,
        sourceTournamentId: tournament.id,
        publishedAt: tournament.closedAt,
        rating: participation.newRating,
        ratingDeviation: participation.newRatingDeviation,
        isStarting: false,
      }),
    ];
  });
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
export function ratingImportSql(events: RatingEventImport[]) {
  const inserts = events.map((event) => {
    const source =
      event.sourceTournamentId === null
        ? 'NULL'
        : quote(event.sourceTournamentId);
    const match = event.isStarting
      ? 'is_starting = 1'
      : `source_tournament_id = ${source}`;
    return `INSERT INTO rating_event (id, player_id, source_tournament_id, published_at, rating, rating_deviation, is_starting)
SELECT lower(hex(randomblob(8))), ${quote(event.playerId)}, ${source}, ${Math.floor(event.publishedAt.getTime() / 1000)}, ${event.rating}, ${event.ratingDeviation}, ${Number(event.isStarting)}
WHERE NOT EXISTS (SELECT 1 FROM rating_event WHERE player_id = ${quote(event.playerId)} AND ${match});`;
  });
  return `-- generated from the frozen legacy export; review the companion report before migration.
-- apply after all pending migrations, with writes still paused. stop on error and ROLLBACK.
-- reruns skip existing events; compare their values with the report, never assume a match.
BEGIN IMMEDIATE;
${inserts.join('\n')}
COMMIT;
SELECT player_id, source_tournament_id, published_at, rating, rating_deviation, is_starting
FROM rating_event ORDER BY player_id, published_at, id;
SELECT is_starting, count(*) AS events FROM rating_event GROUP BY is_starting;
PRAGMA foreign_key_check;
`;
}

if (import.meta.main) {
  const [input, prefix, bounds] = Bun.argv.slice(2);
  const boundsSince =
    bounds === 'always'
      ? -Infinity
      : bounds === 'never'
        ? Infinity
        : Date.parse(bounds ?? '');
  if (
    !input ||
    !prefix ||
    Number.isNaN(boundsSince) ||
    !existsSync(input) ||
    existsSync(`${input}-wal`) ||
    existsSync(`${prefix}.json`) ||
    existsSync(`${prefix}.sql`)
  ) {
    throw new AppError('CONFIG_ERROR', {
      cause:
        'read the reconstruction header: provide a standalone snapshot, new output prefix and verified rating-bounds deployment instant',
    });
  }
  const fingerprint = () =>
    createHash('sha256').update(readFileSync(input)).digest('hex');
  const sha256 = fingerprint();
  // standalone exports can retain WAL mode without needing writable sidecar files.
  const sqlite = new Database(
    `${pathToFileURL(resolve(input)).href}?immutable=1`,
    constants.SQLITE_OPEN_READONLY | constants.SQLITE_OPEN_URI,
  );
  let snapshot: LegacySnapshot;
  try {
    const database = drizzle(sqlite);
    snapshot = sqlite
      .transaction(() =>
        legacySnapshotSchema.parse({
          players: database.select().from(players).all(),
          tournaments: database.select().from(tournaments).all(),
          units: database.select().from(tournament_units).all(),
          participations: database
            .select({
              ...getTableColumns(players_to_units),
              newRating: sql<number | null>`new_rating`,
              newRatingDeviation: sql<number | null>`new_rating_deviation`,
              newVolatility: sql<number | null>`new_volatility`,
            })
            .from(players_to_units)
            .all(),
          games: database.select().from(games).all(),
        }),
      )
      .deferred();
  } finally {
    sqlite.close();
  }
  if (fingerprint() !== sha256)
    throw new AppError('CONFIG_ERROR', {
      cause:
        'snapshot changed while reading; stop and take a consistent export',
    });
  const outcomes = legacyOutcomeEvents(snapshot);
  const cases = reconstructStartingRatings(snapshot, boundsSince);
  const events = [
    ...outcomes,
    ...cases.flatMap((entry) => (entry.event ? [entry.event] : [])),
  ];
  const counts = {
    outcomes: outcomes.length,
    recovered: cases.filter((c) => c.status === 'recovered').length,
    directBaseline: cases.filter((c) => c.status === 'direct-baseline').length,
    skipped: cases.filter((c) => c.status === 'skipped').length,
  };
  await Bun.write(
    `${prefix}.json`,
    JSON.stringify(
      {
        snapshot: resolve(input),
        sha256,
        generatedAt: new Date(),
        counts,
        assumptions: {
          noDeletedRatedTournaments: true,
          normalStartingRd: 350,
          normalStartingVolatility: 0.06,
          slider:
            '0–3000, step 50 (historical superset; no player creation dates)',
          calculator:
            '6ef9e965 fixed drift/integer rd; rating clamping introduced by 477e9a32',
          ratingBoundsSince: bounds,
          ordering:
            'legacy closedAt, validated against forward snapshots and final baselines; ties skipped; client timestamps do not prove real execution order',
          timestamps:
            'earliest surviving closed snapshot minus one second; otherwise stored ratingLastUpdateAt',
          volatilityTolerance: 1e-9,
          maxJointSearchNodes: 500_000,
        },
        outcomes,
        cases,
      },
      null,
      2,
    ) + '\n',
  );
  await Bun.write(`${prefix}.sql`, ratingImportSql(events));
  console.log({ ...counts, report: `${prefix}.json`, sql: `${prefix}.sql` });
  if (counts.skipped) process.exitCode = 2;
}
