ALTER TABLE `game` RENAME COLUMN "rated_white_id" TO "white_player_id";--> statement-breakpoint
ALTER TABLE `game` RENAME COLUMN "rated_black_id" TO "black_player_id";--> statement-breakpoint
ALTER TABLE `game` ALTER COLUMN "white_player_id" TO "white_player_id" text REFERENCES player(id) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game` ALTER COLUMN "black_player_id" TO "black_player_id" text REFERENCES player(id) ON DELETE no action ON UPDATE no action;