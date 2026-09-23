CREATE TABLE `rating_event` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`source_tournament_id` text,
	`published_at` integer NOT NULL,
	`rating` integer NOT NULL,
	`rating_deviation` real NOT NULL,
	`is_starting` integer NOT NULL,
	CONSTRAINT `fk_rating_event_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_rating_event_source_tournament_id_tournament_id_fk` FOREIGN KEY (`source_tournament_id`) REFERENCES `tournament`(`id`) ON DELETE SET NULL,
	CONSTRAINT "rating_event_rating_bounds" CHECK("rating" between 400 and 3400),
	CONSTRAINT "rating_event_starting_has_no_source" CHECK("is_starting" = 0 or "source_tournament_id" is null)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players_to_units` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`number_in_unit` integer NOT NULL,
	CONSTRAINT `fk_players_to_units_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`),
	CONSTRAINT `fk_players_to_units_unit_id_tournament_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `tournament_units`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_players_to_units`(`id`, `player_id`, `unit_id`, `number_in_unit`) SELECT `id`, `player_id`, `unit_id`, `number_in_unit` FROM `players_to_units`;--> statement-breakpoint
DROP TABLE `players_to_units`;--> statement-breakpoint
ALTER TABLE `__new_players_to_units` RENAME TO `players_to_units`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_player` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`realname` text,
	`user_id` text,
	`rating` integer DEFAULT 1500 NOT NULL,
	`rating_peak` integer,
	`rating_deviation` real DEFAULT 350 NOT NULL,
	`rating_volatility` real DEFAULT 0.06 NOT NULL,
	`rating_last_update_at` integer NOT NULL,
	`club_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT `fk_player_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_player_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`),
	CONSTRAINT "player_rating_bounds" CHECK("rating" between 400 and 3400),
	CONSTRAINT "player_rating_peak_bounds" CHECK("rating_peak" is null or "rating_peak" between 400 and 3400)
);
--> statement-breakpoint
INSERT INTO `__new_player`(`id`, `nickname`, `realname`, `user_id`, `rating`, `rating_peak`, `rating_deviation`, `rating_volatility`, `rating_last_update_at`, `club_id`, `last_seen_at`) SELECT `id`, `nickname`, `realname`, `user_id`, `rating`, `rating_peak`, `rating_deviation`, `rating_volatility`, `rating_last_update_at`, `club_id`, `last_seen_at` FROM `player`;--> statement-breakpoint
DROP TABLE `player`;--> statement-breakpoint
ALTER TABLE `__new_player` RENAME TO `player`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ptu_unit_idx` ON `players_to_units` (`unit_id`);--> statement-breakpoint
CREATE INDEX `ptu_player_idx` ON `players_to_units` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_nickname_club_unique_idx` ON `player` (`nickname`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_user_club_unique_idx` ON `player` (`user_id`,`club_id`);--> statement-breakpoint
CREATE INDEX `player_club_last_seen_idx` ON `player` (`club_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `rating_event_player_timeline_idx` ON `rating_event` (`player_id`,`published_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rating_event_player_tournament_unique_idx` ON `rating_event` (`player_id`,`source_tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rating_event_player_starting_unique_idx` ON `rating_event` (`player_id`) WHERE "rating_event"."is_starting" = 1;