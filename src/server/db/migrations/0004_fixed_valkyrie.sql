CREATE TABLE `doubles_team` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`team_player_id` text NOT NULL,
	`first_player_id` text NOT NULL,
	`second_player_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`second_player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doubles_team_tournament_player_unique_idx` ON `doubles_team` (`tournament_id`,`team_player_id`);--> statement-breakpoint
ALTER TABLE `player` ADD `is_pair_team` integer DEFAULT false NOT NULL;