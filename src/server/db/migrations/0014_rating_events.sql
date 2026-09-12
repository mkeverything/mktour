CREATE TABLE `rating_event` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`source_tournament_id` text,
	`published_at` integer NOT NULL,
	`rating` integer NOT NULL,
	`rating_deviation` real NOT NULL,
	`is_starting` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_tournament_id`) REFERENCES `tournament`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "rating_event_rating_bounds" CHECK("rating_event"."rating" between 400 and 3400),
	CONSTRAINT "rating_event_starting_has_no_source" CHECK("rating_event"."is_starting" = 0 or "rating_event"."source_tournament_id" is null)
);
--> statement-breakpoint
CREATE INDEX `rating_event_player_timeline_idx` ON `rating_event` (`player_id`,`published_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rating_event_player_tournament_unique_idx` ON `rating_event` (`player_id`,`source_tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rating_event_player_starting_unique_idx` ON `rating_event` (`player_id`) WHERE "rating_event"."is_starting" = 1;--> statement-breakpoint
DROP INDEX "player_nickname_club_unique_idx";--> statement-breakpoint
DROP INDEX "player_user_club_unique_idx";--> statement-breakpoint
DROP INDEX "player_club_last_seen_idx";--> statement-breakpoint
ALTER TABLE `player` ALTER COLUMN "rating_deviation" TO "rating_deviation" real NOT NULL DEFAULT 350;--> statement-breakpoint
CREATE UNIQUE INDEX `player_nickname_club_unique_idx` ON `player` (`nickname`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_user_club_unique_idx` ON `player` (`user_id`,`club_id`);--> statement-breakpoint
CREATE INDEX `player_club_last_seen_idx` ON `player` (`club_id`,`last_seen_at`);
