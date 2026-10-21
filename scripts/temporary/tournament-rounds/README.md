# tournament rounds cutover

migration `20261019043256_rare_madame_web` makes `tournament.rounds_number` not null.
on a database where it is still pending (prod), fill legacy nulls first:

1. enable maintenance and export the database.
2. `turso db shell <db> < scripts/temporary/tournament-rounds/backfill.sql`; it must
   report `remaining_null_rounds = 0`, otherwise inspect the started tournaments left.
3. deploy and run the migration endpoint, then disable maintenance.

dev and test already applied an older version of the migration; the migrator skips it
by name. delete this folder after prod.
