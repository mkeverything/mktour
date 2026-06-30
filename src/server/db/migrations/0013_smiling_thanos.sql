CREATE INDEX `game_white_unit_idx` ON `game` (`white_unit_id`);--> statement-breakpoint
CREATE INDEX `game_black_unit_idx` ON `game` (`black_unit_id`);--> statement-breakpoint
CREATE INDEX `game_white_player_idx` ON `game` (`white_player_id`);--> statement-breakpoint
CREATE INDEX `game_black_player_idx` ON `game` (`black_player_id`);--> statement-breakpoint
CREATE INDEX `player_club_last_seen_idx` ON `player` (`club_id`,`last_seen_at`);