# postgres cutover

one-off, operator-controlled move of a turso database to postgres. run it for beta first
(its own databases), then main. never edit numbered migrations or their metadata by hand.

## 1. prepare

create an empty postgres database for each environment: production, beta, local
development and tests. the test database name must contain `test`; the test guard checks
it. each app process keeps a pool of up to 10 connections, and a rollout runs two slots
of an environment at once. apply the schema to each:

```sh
DATABASE_URL='<postgres url>' bunx drizzle-kit migrate
```

## 2. rehearse

run steps 4 and 5 with an export of beta into a scratch postgres database, then point a
local dev server at it and open a few player, club and tournament pages.

## 3. maintenance on

turn maintenance on, as the server runbook in `mktour-infra` describes. from here until
step 7 nothing may write to turso, so the export stays complete.

## 4. export

```sh
turso db export <db> --output-file /absolute/export.db
```

it writes the snapshot plus `export.db-wal`; keep both files together and do not rename
one without the other, because sqlite only reads frames from `<database file>-wal`. keep
them private and outside git. the database must have every sqlite migration applied; on
prod, run `scripts/temporary/tournament-rounds/` first, or the import fails on null
`rounds_number`.

## 5. import

from the repository root:

```sh
TARGET_DATABASE_URL='<postgres url>' \
  bun scripts/temporary/postgres-cutover/import-turso-export.ts /absolute/export.db
```

the target must be migrated and empty. the import runs in one transaction: it converts
sqlite integers to timestamps and booleans and json text to `jsonb`, validates every value,
rebuilds `player_stats` from the imported history and prints a count per table. on any
error nothing is written; fix the cause and rerun.

## 6. switch environment variables

in the environment's env file on the server, set `DATABASE_URL` to its postgres url and
delete `DATABASE_AUTH_TOKEN`. running containers keep their old environment; the next
deploy starts its slot with the new one, and its smoke test reads the database through it.
locally, point `TEST_DATABASE_URL` at the test database. ci runs its own postgres service,
so the `TEST_DATABASE_URL` and `TEST_DATABASE_AUTH_TOKEN` repository secrets can go.

## 7. deploy and reopen

merge, and ci deploys the release. check a few player, club and tournament pages, then
turn maintenance off. from then on, rolling back to a turso-era image also needs the old
env file, and loses every write made since.

## cleanup after cutover

once both beta and main are verified, delete `scripts/temporary/postgres-cutover/`, the
private export and the turso databases.
