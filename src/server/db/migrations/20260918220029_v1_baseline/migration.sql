CREATE TABLE `club` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`lichess_team` text UNIQUE,
	`allow_players_set_results` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clubs_to_users` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`promoted_at` integer NOT NULL,
	CONSTRAINT `fk_clubs_to_users_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`),
	CONSTRAINT `fk_clubs_to_users_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	CONSTRAINT `fk_api_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_user_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text,
	CONSTRAINT `fk_user_preferences_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL UNIQUE,
	`username` text NOT NULL UNIQUE,
	`rating` integer,
	`selected_club` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_user_selected_club_club_id_fk` FOREIGN KEY (`selected_club`) REFERENCES `club`(`id`)
);
--> statement-breakpoint
CREATE TABLE `game` (
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
	CONSTRAINT `fk_game_white_unit_id_tournament_units_id_fk` FOREIGN KEY (`white_unit_id`) REFERENCES `tournament_units`(`id`),
	CONSTRAINT `fk_game_black_unit_id_tournament_units_id_fk` FOREIGN KEY (`black_unit_id`) REFERENCES `tournament_units`(`id`),
	CONSTRAINT `fk_game_white_player_id_player_id_fk` FOREIGN KEY (`white_player_id`) REFERENCES `player`(`id`),
	CONSTRAINT `fk_game_black_player_id_player_id_fk` FOREIGN KEY (`black_player_id`) REFERENCES `player`(`id`),
	CONSTRAINT `fk_game_tournament_id_tournament_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`),
	CONSTRAINT `game_white_unit_tournament_fk` FOREIGN KEY (`white_unit_id`,`tournament_id`) REFERENCES `tournament_units`(`id`,`tournament_id`),
	CONSTRAINT `game_black_unit_tournament_fk` FOREIGN KEY (`black_unit_id`,`tournament_id`) REFERENCES `tournament_units`(`id`,`tournament_id`),
	CONSTRAINT "game_units_different" CHECK("white_unit_id" <> "black_unit_id")
);
--> statement-breakpoint
CREATE TABLE `players_to_units` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`number_in_unit` integer NOT NULL,
	`new_rating` integer,
	`new_rating_deviation` integer,
	`new_volatility` real,
	CONSTRAINT `fk_players_to_units_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`),
	CONSTRAINT `fk_players_to_units_unit_id_tournament_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `tournament_units`(`id`),
	CONSTRAINT "ptu_new_rating_bounds" CHECK("new_rating" is null or "new_rating" between 400 and 3400)
);
--> statement-breakpoint
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
	`nickname` text NOT NULL,
	CONSTRAINT `fk_tournament_units_tournament_id_tournament_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`format` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	`club_id` text NOT NULL,
	`started_at` integer,
	`closed_at` integer,
	`rounds_number` integer,
	`ongoing_round` integer NOT NULL,
	`rated` integer NOT NULL,
	CONSTRAINT `fk_tournament_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`club_id` text NOT NULL,
	`player_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_affiliation_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_affiliation_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_affiliation_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `player` (
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
	CONSTRAINT `fk_player_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_player_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`),
	CONSTRAINT "player_rating_bounds" CHECK("rating" between 400 and 3400),
	CONSTRAINT "player_rating_peak_bounds" CHECK("rating_peak" is null or "rating_peak" between 400 and 3400)
);
--> statement-breakpoint
CREATE TABLE `club_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`club_id` text NOT NULL,
	`event` text NOT NULL,
	`is_seen` integer NOT NULL,
	`metadata` text NOT NULL,
	CONSTRAINT `fk_club_notification_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`is_seen` integer NOT NULL,
	`metadata` text NOT NULL,
	CONSTRAINT `fk_user_notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_tournament_number_unique_idx` ON `game` (`tournament_id`,`game_number`);--> statement-breakpoint
CREATE INDEX `game_tournament_round_idx` ON `game` (`tournament_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `game_white_unit_idx` ON `game` (`white_unit_id`);--> statement-breakpoint
CREATE INDEX `game_black_unit_idx` ON `game` (`black_unit_id`);--> statement-breakpoint
CREATE INDEX `game_white_player_idx` ON `game` (`white_player_id`);--> statement-breakpoint
CREATE INDEX `game_black_player_idx` ON `game` (`black_player_id`);--> statement-breakpoint
CREATE INDEX `ptu_unit_idx` ON `players_to_units` (`unit_id`);--> statement-breakpoint
CREATE INDEX `ptu_player_idx` ON `players_to_units` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tu_id_tournament_unique_idx` ON `tournament_units` (`id`,`tournament_id`);--> statement-breakpoint
CREATE INDEX `tu_tournament_number_idx` ON `tournament_units` (`tournament_id`,`number`);--> statement-breakpoint
CREATE INDEX `tu_tournament_nickname_idx` ON `tournament_units` (`tournament_id`,`nickname`);--> statement-breakpoint
CREATE UNIQUE INDEX `affiliation_user_club_unique_idx` ON `affiliation` (`user_id`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_nickname_club_unique_idx` ON `player` (`nickname`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_user_club_unique_idx` ON `player` (`user_id`,`club_id`);--> statement-breakpoint
CREATE INDEX `player_club_last_seen_idx` ON `player` (`club_id`,`last_seen_at`);