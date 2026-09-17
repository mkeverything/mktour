# rating history cutover

one-off, operator-controlled migration. production database credentials stay off the
local machine; the existing authenticated `POST /api/db/migrate` endpoint applies
**all pending generated migrations in one call**. no intermediate pause is needed.
never edit numbered migrations or their metadata by hand.

## rehearse first

run `bun test:noseed src/tests/rating-reconstruction.test.ts`, then rehearse the
complete sequence below on a disposable copy. the test uses local databases only.

## 1. freeze and export

pause and drain all application/job writes, including in-flight requests. preserve
a consistent standalone sqlite export containing players, tournaments, units, games
and all three legacy ptu columns: `new_rating`, `new_rating_deviation`, `new_volatility`.
do not copy a live sqlite main file without its wal. use your existing secure
operator access to obtain the export; no local production credentials are required
by the reconstruction tool.

**do not call the migration endpoint yet.** keep writes paused through import and
verification. keep the export private and outside git; it may contain personal data.

## 2. generate and review offline

from the repository root:

```sh
bun scripts/temporary/rating-events/reconstruct-starting-ratings.ts \
  /absolute/frozen.sqlite /absolute/report-prefix <rating-bounds-since>
```

`rating-bounds-since` is the verified deployment instant of commit `477e9a32`, as an
iso timestamp; use `always` if it predates every closure, or `never` if all closures
predate it. a git author date is not a deployment date. stop if uncertain.

outputs (the paths must not already exist):

- `.json`: snapshot fingerprint, assumptions, outcome rows, reconstructed/direct
  starts, skipped players with reasons, and counts.
- `.sql`: standalone, idempotent inserts for **both outcomes and approved starts**.
  these do not read legacy columns from production and can run after cleanup.

review both files before migration. every closed legacy snapshot with non-null
`new_rating` must have an outcome, even if its starting event cannot be recovered
or it would not qualify under today's rating rules. open/reset snapshots stay out.
exit code 2 means some starts were skipped: review each exception; it is not full
reconstruction success. invalid/missing outcome data or duplicate outcomes stop
export rather than silently discarding history.

preserve the export and reviewed files. confirm outcome counts/values against the
export and approve reconstructed/direct starts and every skipped case.

## 3. migrate once

deploy the intended release while writes remain paused. invoke your existing
secure migration curl command once against `POST /api/db/migrate`, using its usual
bearer secret. it applies all pending migrations, including creation of
`rating_event` and removal of legacy ptu snapshots, and records them in drizzle's
journal. check the endpoint's success response before importing.

do not execute numbered sql files manually, use `migrate.ts` locally against
production, or change the endpoint to accept arbitrary sql/migration cutoffs.

## 4. import and verify

through your existing manual database console access, execute the reviewed `.sql`
in one connection with stop-on-error. on error, `ROLLBACK` and investigate; do not
resume partway through the file. reruns skip existing events, so mismatched existing
rows must be investigated, not treated as success merely because counts match.

before reopening writes:

- compare every imported outcome/start with the saved report, including player,
  source tournament, rating, rd, timestamp and starting flag. sql timestamps are
  unix seconds; report dates are iso. random event ids are not comparison keys.
- compare event counts with report `outcomes`, `recovered` and `directBaseline`.
- compare all player fields and surviving ptu membership fields with the export.
- confirm legacy ptu columns are gone and `PRAGMA foreign_key_check` returns no rows.
- verify the new application works, then reopen writes.

## stop and rollback

never migrate with a missing/unreviewed export or generate history from already
cleaned production tables. preserve the export/report/sql after cutover.

before reopening writes, rollback means restoring the complete pre-migration
export (including its migration journal) and the old application. after reopening,
stop and assess new writes before any restore. do not rerun legacy backfill after
merges or use this process as retrospective rating repair.
