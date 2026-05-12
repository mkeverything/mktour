DROP INDEX "club_lichess_team_unique";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "user_username_unique";--> statement-breakpoint
DROP INDEX "game_tournament_round_idx";--> statement-breakpoint
DROP INDEX "ptu_unit_idx";--> statement-breakpoint
DROP INDEX "ptu_player_idx";--> statement-breakpoint
DROP INDEX "tu_tournament_number_idx";--> statement-breakpoint
DROP INDEX "tu_tournament_nickname_idx";--> statement-breakpoint
DROP INDEX "affiliation_user_club_unique_idx";--> statement-breakpoint
DROP INDEX "player_nickname_club_unique_idx";--> statement-breakpoint
DROP INDEX "player_user_club_unique_idx";--> statement-breakpoint
ALTER TABLE `tournament_units` ALTER COLUMN "nickname" TO "nickname" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `club_lichess_team_unique` ON `club` (`lichess_team`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `game_tournament_round_idx` ON `game` (`tournament_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `ptu_unit_idx` ON `players_to_units` (`unit_id`);--> statement-breakpoint
CREATE INDEX `ptu_player_idx` ON `players_to_units` (`player_id`);--> statement-breakpoint
CREATE INDEX `tu_tournament_number_idx` ON `tournament_units` (`tournament_id`,`number`);--> statement-breakpoint
CREATE INDEX `tu_tournament_nickname_idx` ON `tournament_units` (`tournament_id`,`nickname`);--> statement-breakpoint
CREATE UNIQUE INDEX `affiliation_user_club_unique_idx` ON `affiliation` (`user_id`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_nickname_club_unique_idx` ON `player` (`nickname`,`club_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_user_club_unique_idx` ON `player` (`user_id`,`club_id`);