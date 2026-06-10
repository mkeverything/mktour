ALTER TABLE `game` RENAME COLUMN "white_id" TO "white_unit_id";--> statement-breakpoint
ALTER TABLE `game` RENAME COLUMN "black_id" TO "black_unit_id";--> statement-breakpoint
CREATE TABLE `players_to_units` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`number_in_unit` integer NOT NULL,
	`new_rating` integer,
	`new_rating_deviation` integer,
	`new_volatility` real,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `tournament_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ptu_unit_idx` ON `players_to_units` (`unit_id`);--> statement-breakpoint
CREATE INDEX `ptu_player_idx` ON `players_to_units` (`player_id`);--> statement-breakpoint
CREATE TABLE `tournament_units` (
	`id` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`tournament_id` text NOT NULL,
	`wins` integer NOT NULL,
	`losses` integer NOT NULL,
	`draws` integer NOT NULL,
	`color_index` integer NOT NULL,
	`place` integer,
	`is_out` integer,
	`number` integer,
	`added_at` integer,
	`nickname` text,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tu_tournament_number_idx` ON `tournament_units` (`tournament_id`,`number`);--> statement-breakpoint
CREATE INDEX `tu_tournament_nickname_idx` ON `tournament_units` (`tournament_id`,`nickname`);--> statement-breakpoint
CREATE INDEX `game_tournament_round_idx` ON `game` (`tournament_id`,`round_number`);--> statement-breakpoint
ALTER TABLE `game` ALTER COLUMN "white_unit_id" TO "white_unit_id" text NOT NULL REFERENCES tournament_units(id) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game` ALTER COLUMN "black_unit_id" TO "black_unit_id" text NOT NULL REFERENCES tournament_units(id) ON DELETE no action ON UPDATE no action;