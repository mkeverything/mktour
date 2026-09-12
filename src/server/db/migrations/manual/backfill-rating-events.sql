-- one-off data reconstruction for `rating_event`. run by hand in the db console,
-- after migration 0014 and before the legacy snapshot columns on
-- `players_to_units` are dropped. safe to re-run: every insert skips rows that
-- already exist.
--
-- 1. tournament outcomes from legacy participation snapshots.
--    only snapshots of currently closed tournaments qualify; a snapshot left
--    behind by resetting a closed tournament has no closure to publish under.
--    published_at is the legacy client-supplied closed_at; no better value exists.
INSERT INTO rating_event (id, player_id, source_tournament_id, published_at, rating, rating_deviation, is_starting)
SELECT
	lower(hex(randomblob(8))),
	ptu.player_id,
	tu.tournament_id,
	t.closed_at,
	ptu.new_rating,
	ptu.new_rating_deviation,
	0
FROM players_to_units ptu
JOIN tournament_units tu ON tu.id = ptu.unit_id
JOIN tournament t ON t.id = tu.tournament_id
WHERE ptu.new_rating IS NOT NULL
	AND ptu.new_rating_deviation IS NOT NULL
	AND t.closed_at IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM rating_event e
		WHERE e.player_id = ptu.player_id AND e.source_tournament_id = tu.tournament_id
	);

-- 2. starting events for players who never received a rating outcome.
--    their current rating and rd are still their starting values, so the
--    starting event is exact and needs no reconstruction.
INSERT INTO rating_event (id, player_id, source_tournament_id, published_at, rating, rating_deviation, is_starting)
SELECT
	lower(hex(randomblob(8))),
	p.id,
	NULL,
	p.rating_last_update_at,
	p.rating,
	p.rating_deviation,
	1
FROM player p
WHERE NOT EXISTS (SELECT 1 FROM rating_event e WHERE e.player_id = p.id);

-- players with outcomes but no starting event are left for the
-- starting-rating reconstruction step; list them for review.
SELECT p.id, p.nickname, p.club_id, count(e.id) AS outcomes, min(e.published_at) AS first_outcome_at
FROM player p
JOIN rating_event e ON e.player_id = p.id AND e.is_starting = 0
WHERE NOT EXISTS (SELECT 1 FROM rating_event s WHERE s.player_id = p.id AND s.is_starting = 1)
GROUP BY p.id
ORDER BY p.club_id, first_outcome_at;

-- sanity: every closed rated tournament's snapshot count equals its event count.
SELECT
	(SELECT count(*) FROM players_to_units ptu
		JOIN tournament_units tu ON tu.id = ptu.unit_id
		JOIN tournament t ON t.id = tu.tournament_id
		WHERE ptu.new_rating IS NOT NULL AND t.closed_at IS NOT NULL) AS legacy_snapshots,
	(SELECT count(*) FROM rating_event WHERE is_starting = 0 AND source_tournament_id IS NOT NULL) AS outcome_events,
	(SELECT count(*) FROM rating_event WHERE is_starting = 1) AS starting_events,
	(SELECT count(*) FROM player) AS players;
