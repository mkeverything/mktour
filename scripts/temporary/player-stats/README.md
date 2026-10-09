# player stats cutover

one-off, operator-controlled backfill of the `player_stats` projection. run it on beta
first (its own database), then on main. production database credentials stay off the
local machine except for your usual turso cli access; the generator itself only reads a
local export. never edit numbered migrations or their metadata by hand.

## rehearse first

run `bun test:noseed scripts/temporary/player-stats/generate-player-stats-sql.test.ts`,
then rehearse the sequence below on a disposable database copy.

## 1. maintenance on

turn maintenance on before merging. from here until step 5 no player, tournament or
merge can change, so the export stays complete. the websocket server only reads for
authentication and needs no pause.

## 2. export and generate

export the database with `turso db export <db> --output-file /absolute/export.db`.
it writes the snapshot plus `export.db-wal`; keep both files together and do not rename
one without the other, because sqlite only reads frames from `<database file>-wal`.
keep them private and outside git. then, from the repository root:

```sh
bun scripts/temporary/player-stats/generate-player-stats-sql.ts \
  /absolute/export.db /absolute/player-stats.sql
```

the output path must not exist. the file contains one idempotent upsert per player
inside `BEGIN IMMEDIATE` / `COMMIT`, followed by verification queries. ratings are
ranked against the generation instant.

## 3. deploy and migrate

merge and deploy the release, then invoke the existing secure migration curl command
once against `POST /api/db/migrate`. it creates `player_stats` and the new player
indexes. until step 4 every stats read throws `PLAYER_NOT_FOUND`; maintenance hides it.

## 4. apply and verify

```sh
turso db shell <db> < /absolute/player-stats.sql
```

on error, `ROLLBACK`, investigate and rerun the whole file; the upserts are idempotent.
the trailing queries must show `players_without_stats = 0` and an empty
`PRAGMA foreign_key_check`.

## 5. reopen

check a few player pages and the club page, then turn maintenance off.

## cleanup after cutover

once both beta and main are verified, delete `scripts/temporary/player-stats/`,
including its test. delete the private export and generated sql.
