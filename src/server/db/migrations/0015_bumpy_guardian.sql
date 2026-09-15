PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players_to_units` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`number_in_unit` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `tournament_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_players_to_units`("id", "player_id", "unit_id", "number_in_unit") SELECT "id", "player_id", "unit_id", "number_in_unit" FROM `players_to_units`;--> statement-breakpoint
DROP TABLE `players_to_units`;--> statement-breakpoint
ALTER TABLE `__new_players_to_units` RENAME TO `players_to_units`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ptu_unit_idx` ON `players_to_units` (`unit_id`);--> statement-breakpoint
CREATE INDEX `ptu_player_idx` ON `players_to_units` (`player_id`);