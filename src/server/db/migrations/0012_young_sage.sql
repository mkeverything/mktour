PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players_to_units` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`number_in_unit` integer NOT NULL,
	`new_rating` integer,
	`new_rating_deviation` integer,
	`new_volatility` real,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `tournament_units`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ptu_new_rating_bounds" CHECK("__new_players_to_units"."new_rating" is null or "__new_players_to_units"."new_rating" between 400 and 3400)
);
--> statement-breakpoint
INSERT INTO `__new_players_to_units`("id", "player_id", "unit_id", "number_in_unit", "new_rating", "new_rating_deviation", "new_volatility") SELECT "id", "player_id", "unit_id", "number_in_unit", "new_rating", "new_rating_deviation", "new_volatility" FROM `players_to_units`;--> statement-breakpoint
DROP TABLE `players_to_units`;--> statement-breakpoint
ALTER TABLE `__new_players_to_units` RENAME TO `players_to_units`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ptu_unit_idx` ON `players_to_units` (`unit_id`);--> statement-breakpoint
CREATE INDEX `ptu_player_idx` ON `players_to_units` (`player_id`);--> statement-breakpoint
CREATE TABLE `__new_player` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`realname` text,
	`user_id` text,
	`rating` integer DEFAULT 1500 NOT NULL,
	`rating_peak` integer,
	`rating_deviation` integer DEFAULT 350 NOT NULL,
	`rating_volatility` real DEFAULT 0.06 NOT NULL,
	`rating_last_update_at` integer NOT NULL,
	`club_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `club`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "player_rating_bounds" CHECK("__new_player"."rating" between 400 and 3400),
	CONSTRAINT "player_rating_peak_bounds" CHECK("__new_player"."rating_peak" is null or "__new_player"."rating_peak" between 400 and 3400)
);
--> statement-breakpoint
INSERT INTO `__new_player`("id", "nickname", "realname", "user_id", "rating", "rating_peak", "rating_deviation", "rating_volatility", "rating_last_update_at", "club_id", "last_seen_at") SELECT "id", "nickname", "realname", "user_id", "rating", "rating_peak", "rating_deviation", "rating_volatility", "rating_last_update_at", "club_id", "last_seen_at" FROM `player`;--> statement-breakpoint
DROP TABLE `player`;--> statement-breakpoint
ALTER TABLE `__new_player` RENAME TO `player`;--> statement-breakpoint
CREATE UNIQUE INDEX `player_nickname_club_unique_idx` ON `player` (`nickname`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_user_club_unique_idx` ON `player` (`user_id`,`club_id`);