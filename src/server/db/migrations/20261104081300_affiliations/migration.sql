DROP INDEX "affiliation_user_club_unique_idx";--> statement-breakpoint
ALTER TABLE "club_notification" ADD COLUMN "affiliation_id" text;--> statement-breakpoint
ALTER TABLE "club_notification" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "club_notification" ADD COLUMN "player_id" text;--> statement-breakpoint
ALTER TABLE "user_notification" ADD COLUMN "affiliation_id" text;--> statement-breakpoint
ALTER TABLE "user_notification" ADD COLUMN "club_id" text;--> statement-breakpoint
ALTER TABLE "user_notification" ADD COLUMN "tournament_id" text;--> statement-breakpoint
ALTER TABLE "affiliation" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "affiliation_status";--> statement-breakpoint
CREATE TYPE "affiliation_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TABLE "affiliation" ALTER COLUMN "status" SET DATA TYPE "affiliation_status" USING "status"::"affiliation_status";--> statement-breakpoint
ALTER TABLE "club_notification" ALTER COLUMN "event" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "club_notification_event";--> statement-breakpoint
CREATE TYPE "club_notification_event" AS ENUM('manager_left', 'affiliation_cancelled', 'player_merged');--> statement-breakpoint
ALTER TABLE "club_notification" ALTER COLUMN "event" SET DATA TYPE "club_notification_event" USING "event"::"club_notification_event";--> statement-breakpoint
ALTER TABLE "club_notification" ALTER COLUMN "metadata" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification" ALTER COLUMN "metadata" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliation_open_user_club_unique_idx" ON "affiliation" ("user_id","club_id") WHERE "status" in ('requested', 'approved');--> statement-breakpoint
CREATE UNIQUE INDEX "affiliation_open_player_unique_idx" ON "affiliation" ("player_id") WHERE "status" in ('requested', 'approved');--> statement-breakpoint
ALTER TABLE "club_notification" ADD CONSTRAINT "club_notification_affiliation_id_affiliation_id_fkey" FOREIGN KEY ("affiliation_id") REFERENCES "affiliation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "club_notification" ADD CONSTRAINT "club_notification_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "club_notification" ADD CONSTRAINT "club_notification_player_id_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_affiliation_id_affiliation_id_fkey" FOREIGN KEY ("affiliation_id") REFERENCES "affiliation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_club_id_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_tournament_id_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE CASCADE;