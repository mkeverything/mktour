-- one-off, manually applied sql. never run with application writes active.
-- rehearse on a copy first; nothing from this branch has reached production.
--
-- 1. pause/drain writes and preserve a consistent final export with all old ptu
--    snapshot columns. keep writes paused until the new application is activated.
-- 2. apply generated schema migrations only through 0014_rating_events.
--    do not apply 0015 yet; it removes the inputs needed below.
--    do not use migrate.ts for production (it targets development and test dbs).
-- 3. run this file in one turso shell connection, stopping on errors; ROLLBACK
--    on error and investigate. do not skip invalid or conflicting snapshots.
-- 4. export the frozen database as a standalone local sqlite file and run
--    reconstruct-starting-ratings.ts following its header. save/review the report,
--    every skipped player and generated starting sql, then manually apply it.
-- 5. verify the counts below match, and that the mismatch query returns no rows.
--    compare starting events with the approved report, all player fields with the
--    saved export, and PRAGMA foreign_key_check (must return no rows).
-- 6. only then apply drizzle-generated 0015, verify preserved membership/player
--    records, activate the new app and reopen writes. never rerun this backfill
--    after activation/merges; its source columns must already have been retired.
--
-- preserve the export/report/reviewed sql. before reopening writes, rollback
-- means restore the entire export and old app. after reopening, stop and assess
-- new writes before restoring anything.
-- legacy closed snapshots are outcomes even if a player would not qualify under
-- today's rules. open/reset snapshots are excluded; this is not historical repair.

BEGIN IMMEDIATE;
INSERT INTO rating_event (id, player_id, source_tournament_id, published_at, rating, rating_deviation, is_starting)
SELECT lower(hex(randomblob(8))), ptu.player_id, t.id, t.closed_at,
  ptu.new_rating, ptu.new_rating_deviation, 0
FROM players_to_units ptu
JOIN tournament_units tu ON tu.id = ptu.unit_id
JOIN tournament t ON t.id = tu.tournament_id
WHERE ptu.new_rating IS NOT NULL AND t.closed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rating_event e
    WHERE e.player_id = ptu.player_id AND e.source_tournament_id = t.id
  );
COMMIT;

SELECT
  (SELECT count(*) FROM players_to_units ptu
    JOIN tournament_units tu ON tu.id = ptu.unit_id
    JOIN tournament t ON t.id = tu.tournament_id
    WHERE ptu.new_rating IS NOT NULL AND t.closed_at IS NOT NULL) AS legacy_snapshots,
  (SELECT count(*) FROM rating_event WHERE is_starting = 0) AS outcome_events;

SELECT ptu.player_id, t.id AS tournament_id
FROM players_to_units ptu
JOIN tournament_units tu ON tu.id = ptu.unit_id
JOIN tournament t ON t.id = tu.tournament_id
LEFT JOIN rating_event e ON e.player_id = ptu.player_id AND e.source_tournament_id = t.id
WHERE ptu.new_rating IS NOT NULL AND t.closed_at IS NOT NULL
  AND (e.id IS NULL OR e.is_starting IS NOT 0 OR e.rating IS NOT ptu.new_rating
    OR e.rating_deviation IS NOT ptu.new_rating_deviation
    OR e.published_at IS NOT t.closed_at);
PRAGMA foreign_key_check;
