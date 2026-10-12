CREATE TABLE `player_stats` (
	`player_id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`tournaments_played` integer DEFAULT 0 NOT NULL,
	`tournaments_won` integer DEFAULT 0 NOT NULL,
	`games_won` integer DEFAULT 0 NOT NULL,
	`games_drawn` integer DEFAULT 0 NOT NULL,
	`games_lost` integer DEFAULT 0 NOT NULL,
	`games_played` integer GENERATED ALWAYS AS (games_won + games_drawn + games_lost) STORED NOT NULL,
	`rating_rank` integer,
	`tournaments_played_rank` integer,
	`tournaments_won_rank` integer,
	`games_played_rank` integer,
	CONSTRAINT `fk_player_stats_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE,
	CONSTRAINT "player_stats_counts_non_negative" CHECK("tournaments_played" >= 0 and "tournaments_won" >= 0 and "games_won" >= 0 and "games_drawn" >= 0 and "games_lost" >= 0)
);
--> statement-breakpoint
CREATE INDEX `player_stats_club_rating_rank_idx` ON `player_stats` (`club_id`,`rating_rank`);--> statement-breakpoint
CREATE INDEX `player_stats_club_tournaments_played_rank_idx` ON `player_stats` (`club_id`,`tournaments_played_rank`);--> statement-breakpoint
CREATE INDEX `player_stats_club_tournaments_won_rank_idx` ON `player_stats` (`club_id`,`tournaments_won_rank`);--> statement-breakpoint
CREATE INDEX `player_stats_club_games_played_rank_idx` ON `player_stats` (`club_id`,`games_played_rank`);--> statement-breakpoint
CREATE INDEX `player_club_rating_idx` ON `player` (`club_id`,"rating" desc,`rating_deviation`,`id`);