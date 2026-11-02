CREATE TYPE "affiliation_status" AS ENUM('requested_by_user', 'requested_by_club', 'active');--> statement-breakpoint
CREATE TYPE "club_notification_event" AS ENUM('affiliation_request', 'manager_left', 'affiliation_request_approved', 'affiliation_request_rejected', 'affiliation_cancelled', 'player_merged');--> statement-breakpoint
CREATE TYPE "game_result" AS ENUM('1-0', '0-1', '1/2-1/2');--> statement-breakpoint
CREATE TYPE "round_name" AS ENUM('final', 'match_for_third', 'semifinal', 'quarterfinal', '1/8', '1/16', '1/32', '1/64', '1/128');--> statement-breakpoint
CREATE TYPE "status_in_club" AS ENUM('admin', 'co-owner');--> statement-breakpoint
CREATE TYPE "tournament_format" AS ENUM('swiss', 'round robin');--> statement-breakpoint
CREATE TYPE "tournament_type" AS ENUM('solo', 'doubles');--> statement-breakpoint
CREATE TYPE "user_notification_event" AS ENUM('affiliation_approved', 'affiliation_rejected', 'affiliation_cancelled', 'tournament_won', 'became_club_manager', 'removed_from_club_managers');--> statement-breakpoint
CREATE TABLE "club" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp(3) with time zone NOT NULL,
	"lichess_team" text UNIQUE,
	"allow_players_set_results" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs_to_users" (
	"club_id" text,
	"user_id" text,
	"status" "status_in_club" NOT NULL,
	"promoted_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_to_users_pkey" PRIMARY KEY("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "api_token" (
	"id" text PRIMARY KEY,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"last_used_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "user_session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text,
	"email" text NOT NULL UNIQUE,
	"username" text NOT NULL UNIQUE,
	"rating" integer,
	"selected_club" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" text PRIMARY KEY,
	"game_number" integer NOT NULL,
	"round_number" integer NOT NULL,
	"round_name" "round_name",
	"white_unit_id" text NOT NULL,
	"black_unit_id" text NOT NULL,
	"white_player_id" text,
	"black_player_id" text,
	"result" "game_result",
	"finished_at" timestamp(3) with time zone,
	"tournament_id" text NOT NULL,
	CONSTRAINT "game_units_different" CHECK ("white_unit_id" <> "black_unit_id")
);
--> statement-breakpoint
CREATE TABLE "players_to_units" (
	"player_id" text,
	"unit_id" text,
	"tournament_id" text NOT NULL,
	"number_in_unit" integer NOT NULL,
	CONSTRAINT "players_to_units_pkey" PRIMARY KEY("unit_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_units" (
	"id" text PRIMARY KEY,
	"size" integer NOT NULL,
	"tournament_id" text NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"color_index" integer DEFAULT 0 NOT NULL,
	"place" integer,
	"is_out" boolean DEFAULT false NOT NULL,
	"number" integer,
	"added_at" timestamp(3) with time zone,
	"nickname" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" text PRIMARY KEY,
	"title" text,
	"format" "tournament_format" NOT NULL,
	"type" "tournament_type" NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"club_id" text NOT NULL,
	"started_at" timestamp(3) with time zone,
	"closed_at" timestamp(3) with time zone,
	"rounds_number" integer NOT NULL,
	"ongoing_round" integer DEFAULT 1 NOT NULL,
	"rated" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliation" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"club_id" text NOT NULL,
	"player_id" text NOT NULL,
	"status" "affiliation_status" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"player_id" text PRIMARY KEY,
	"club_id" text NOT NULL,
	"tournaments_played" integer DEFAULT 0 NOT NULL,
	"tournaments_won" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_drawn" integer DEFAULT 0 NOT NULL,
	"games_lost" integer DEFAULT 0 NOT NULL,
	"games_played" integer GENERATED ALWAYS AS (games_won + games_drawn + games_lost) STORED NOT NULL,
	"rating_rank" integer,
	"tournaments_played_rank" integer,
	"tournaments_won_rank" integer,
	"games_played_rank" integer,
	CONSTRAINT "player_stats_counts_non_negative" CHECK ("tournaments_played" >= 0 and "tournaments_won" >= 0 and "games_won" >= 0 and "games_drawn" >= 0 and "games_lost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" text PRIMARY KEY,
	"nickname" text NOT NULL,
	"realname" text,
	"user_id" text,
	"rating" integer DEFAULT 1500 NOT NULL,
	"rating_peak" integer,
	"rating_deviation" double precision DEFAULT 350 NOT NULL,
	"rating_volatility" double precision DEFAULT 0.06 NOT NULL,
	"rating_last_update_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"club_id" text NOT NULL,
	"last_seen_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_rating_bounds" CHECK ("rating" between 400 and 3400),
	CONSTRAINT "player_rating_peak_bounds" CHECK ("rating_peak" is null or "rating_peak" between 400 and 3400)
);
--> statement-breakpoint
CREATE TABLE "rating_event" (
	"id" text PRIMARY KEY,
	"player_id" text NOT NULL,
	"source_tournament_id" text,
	"published_at" timestamp(3) with time zone NOT NULL,
	"rating" integer NOT NULL,
	"rating_deviation" double precision NOT NULL,
	"is_starting" boolean NOT NULL,
	CONSTRAINT "rating_event_rating_bounds" CHECK ("rating" between 400 and 3400),
	CONSTRAINT "rating_event_starting_has_no_source" CHECK (not "is_starting" or "source_tournament_id" is null)
);
--> statement-breakpoint
CREATE TABLE "club_notification" (
	"id" text PRIMARY KEY,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"club_id" text NOT NULL,
	"event" "club_notification_event" NOT NULL,
	"is_seen" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification" (
	"id" text PRIMARY KEY,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"event" "user_notification_event" NOT NULL,
	"is_seen" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clubs_to_users_user_idx" ON "clubs_to_users" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_tournament_number_unique_idx" ON "game" ("tournament_id","game_number");--> statement-breakpoint
CREATE INDEX "game_tournament_round_idx" ON "game" ("tournament_id","round_number");--> statement-breakpoint
CREATE INDEX "game_white_unit_idx" ON "game" ("white_unit_id");--> statement-breakpoint
CREATE INDEX "game_black_unit_idx" ON "game" ("black_unit_id");--> statement-breakpoint
CREATE INDEX "game_white_player_idx" ON "game" ("white_player_id");--> statement-breakpoint
CREATE INDEX "game_black_player_idx" ON "game" ("black_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ptu_tournament_player_unique_idx" ON "players_to_units" ("tournament_id","player_id");--> statement-breakpoint
CREATE INDEX "ptu_player_idx" ON "players_to_units" ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tu_id_tournament_unique_idx" ON "tournament_units" ("id","tournament_id");--> statement-breakpoint
CREATE INDEX "tu_tournament_number_idx" ON "tournament_units" ("tournament_id","number");--> statement-breakpoint
CREATE INDEX "tu_tournament_nickname_idx" ON "tournament_units" ("tournament_id","nickname");--> statement-breakpoint
CREATE INDEX "tournament_club_date_idx" ON "tournament" ("club_id","date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "affiliation_user_club_unique_idx" ON "affiliation" ("user_id","club_id");--> statement-breakpoint
CREATE INDEX "player_stats_club_rating_rank_idx" ON "player_stats" ("club_id","rating_rank");--> statement-breakpoint
CREATE INDEX "player_stats_club_tournaments_played_rank_idx" ON "player_stats" ("club_id","tournaments_played_rank");--> statement-breakpoint
CREATE INDEX "player_stats_club_tournaments_won_rank_idx" ON "player_stats" ("club_id","tournaments_won_rank");--> statement-breakpoint
CREATE INDEX "player_stats_club_games_played_rank_idx" ON "player_stats" ("club_id","games_played_rank");--> statement-breakpoint
CREATE UNIQUE INDEX "player_club_nickname_unique_idx" ON "player" ("club_id",lower("nickname"));--> statement-breakpoint
CREATE UNIQUE INDEX "player_user_club_unique_idx" ON "player" ("user_id","club_id");--> statement-breakpoint
CREATE INDEX "player_club_last_seen_idx" ON "player" ("club_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "player_club_rating_idx" ON "player" ("club_id","rating" DESC NULLS LAST,"rating_deviation","id");--> statement-breakpoint
CREATE INDEX "rating_event_player_timeline_idx" ON "rating_event" ("player_id","published_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_event_player_tournament_unique_idx" ON "rating_event" ("player_id","source_tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_event_player_starting_unique_idx" ON "rating_event" ("player_id") WHERE "is_starting";--> statement-breakpoint
CREATE INDEX "club_notification_club_created_idx" ON "club_notification" ("club_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_user_created_idx" ON "user_notification" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "clubs_to_users" ADD CONSTRAINT "clubs_to_users_club_id_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "clubs_to_users" ADD CONSTRAINT "clubs_to_users_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_selected_club_club_id_fkey" FOREIGN KEY ("selected_club") REFERENCES "club"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_white_player_id_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_black_player_id_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_tournament_id_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_white_unit_tournament_fk" FOREIGN KEY ("white_unit_id","tournament_id") REFERENCES "tournament_units"("id","tournament_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_black_unit_tournament_fk" FOREIGN KEY ("black_unit_id","tournament_id") REFERENCES "tournament_units"("id","tournament_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "players_to_units" ADD CONSTRAINT "players_to_units_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id");--> statement-breakpoint
ALTER TABLE "players_to_units" ADD CONSTRAINT "ptu_unit_tournament_fk" FOREIGN KEY ("unit_id","tournament_id") REFERENCES "tournament_units"("id","tournament_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tournament_units" ADD CONSTRAINT "tournament_units_tournament_id_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_club_id_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_club_id_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_club_id_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rating_event" ADD CONSTRAINT "rating_event_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rating_event" ADD CONSTRAINT "rating_event_source_tournament_id_tournament_id_fkey" FOREIGN KEY ("source_tournament_id") REFERENCES "tournament"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "club_notification" ADD CONSTRAINT "club_notification_club_id_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;