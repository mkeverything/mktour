UPDATE `tournament` SET `rounds_number` = CASE WHEN `format` = 'swiss' THEN 1 ELSE 0 END WHERE `rounds_number` IS NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tournament` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`format` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	`club_id` text NOT NULL,
	`started_at` integer,
	`closed_at` integer,
	`rounds_number` integer NOT NULL,
	`ongoing_round` integer NOT NULL,
	`rated` integer NOT NULL,
	CONSTRAINT `fk_tournament_club_id_club_id_fk` FOREIGN KEY (`club_id`) REFERENCES `club`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_tournament`(`id`, `name`, `format`, `type`, `date`, `created_at`, `club_id`, `started_at`, `closed_at`, `rounds_number`, `ongoing_round`, `rated`) SELECT `id`, `name`, `format`, `type`, `date`, `created_at`, `club_id`, `started_at`, `closed_at`, `rounds_number`, `ongoing_round`, `rated` FROM `tournament`;--> statement-breakpoint
DROP TABLE `tournament`;--> statement-breakpoint
ALTER TABLE `__new_tournament` RENAME TO `tournament`;--> statement-breakpoint
PRAGMA foreign_keys=ON;