BEGIN IMMEDIATE;

UPDATE tournament
SET rounds_number = CASE format WHEN 'swiss' THEN 1 ELSE 0 END
WHERE rounds_number IS NULL
  AND started_at IS NULL
  AND closed_at IS NULL
  AND format IN ('swiss', 'round robin');

COMMIT;

SELECT count(*) AS remaining_null_rounds
FROM tournament
WHERE rounds_number IS NULL;
