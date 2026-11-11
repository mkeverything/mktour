ALTER TABLE "club" RENAME COLUMN "allow_players_set_results" TO "is_player_self_reporting_enabled";--> statement-breakpoint
ALTER TABLE "tournament" RENAME COLUMN "rated" TO "is_rated";