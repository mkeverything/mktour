PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game` (
	`id` text PRIMARY KEY NOT NULL,
	`game_number` integer NOT NULL,
	`round_number` integer NOT NULL,
	`round_name` text,
	`white_unit_id` text NOT NULL,
	`black_unit_id` text NOT NULL,
	`white_player_id` text,
	`black_player_id` text,
	`white_prev_game_id` text,
	`black_prev_game_id` text,
	`result` text,
	`finished_at` integer,
	`tournament_id` text NOT NULL,
	FOREIGN KEY (`white_unit_id`) REFERENCES `tournament_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_unit_id`) REFERENCES `tournament_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`white_player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`white_unit_id`,`tournament_id`) REFERENCES `tournament_units`(`id`,`tournament_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_unit_id`,`tournament_id`) REFERENCES `tournament_units`(`id`,`tournament_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "game_units_different" CHECK("__new_game"."white_unit_id" <> "__new_game"."black_unit_id")
);
--> statement-breakpoint
INSERT INTO `__new_game`("id", "game_number", "round_number", "round_name", "white_unit_id", "black_unit_id", "white_player_id", "black_player_id", "white_prev_game_id", "black_prev_game_id", "result", "finished_at", "tournament_id") SELECT "id", "game_number", "round_number", "round_name", "white_unit_id", "black_unit_id", "white_player_id", "black_player_id", "white_prev_game_id", "black_prev_game_id", "result", "finished_at", "tournament_id" FROM `game`;--> statement-breakpoint
DROP TABLE `game`;--> statement-breakpoint
ALTER TABLE `__new_game` RENAME TO `game`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `game_tournament_number_unique_idx` ON `game` (`tournament_id`,`game_number`);--> statement-breakpoint
CREATE INDEX `game_tournament_round_idx` ON `game` (`tournament_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `game_white_unit_idx` ON `game` (`white_unit_id`);--> statement-breakpoint
CREATE INDEX `game_black_unit_idx` ON `game` (`black_unit_id`);--> statement-breakpoint
CREATE INDEX `game_white_player_idx` ON `game` (`white_player_id`);--> statement-breakpoint
CREATE INDEX `game_black_player_idx` ON `game` (`black_player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tu_id_tournament_unique_idx` ON `tournament_units` (`id`,`tournament_id`);--> statement-breakpoint
CREATE INDEX `player_club_last_seen_idx` ON `player` (`club_id`,`last_seen_at`);