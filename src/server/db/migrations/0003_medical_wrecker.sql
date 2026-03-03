ALTER TABLE `players_to_tournaments` RENAME COLUMN "rating_change" TO "new_rating";--> statement-breakpoint
ALTER TABLE `players_to_tournaments` RENAME COLUMN "rating_deviation_change" TO "new_rating_deviation";--> statement-breakpoint
ALTER TABLE `players_to_tournaments` RENAME COLUMN "volatility_change" TO "new_volatility";