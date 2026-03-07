DROP TABLE `doubles_team`;--> statement-breakpoint
ALTER TABLE `players_to_tournaments` ADD `team_nickname` text;--> statement-breakpoint
ALTER TABLE `player` DROP COLUMN `is_pair_team`;