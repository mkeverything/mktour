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
	CONSTRAINT `player_stats_player_club_fk` FOREIGN KEY (`player_id`,`club_id`) REFERENCES `player`(`id`,`club_id`) ON DELETE CASCADE,
	CONSTRAINT "player_stats_counts_non_negative" CHECK("tournaments_played" >= 0 and "tournaments_won" >= 0 and "games_won" >= 0 and "games_drawn" >= 0 and "games_lost" >= 0),
	CONSTRAINT "player_stats_tournament_wins_lte_played" CHECK("tournaments_won" <= "tournaments_played"),
	CONSTRAINT "player_stats_ranks_positive" CHECK(("rating_rank" is null or "rating_rank" >= 1) and ("tournaments_played_rank" is null or "tournaments_played_rank" >= 1) and ("tournaments_won_rank" is null or "tournaments_won_rank" >= 1) and ("games_played_rank" is null or "games_played_rank" >= 1))
);
--> statement-breakpoint
CREATE INDEX `player_stats_club_rating_rank_idx` ON `player_stats` (`club_id`,`rating_rank`);--> statement-breakpoint
CREATE INDEX `player_stats_club_tournaments_played_rank_idx` ON `player_stats` (`club_id`,`tournaments_played_rank`);--> statement-breakpoint
CREATE INDEX `player_stats_club_tournaments_won_rank_idx` ON `player_stats` (`club_id`,`tournaments_won_rank`);--> statement-breakpoint
CREATE INDEX `player_stats_club_games_played_rank_idx` ON `player_stats` (`club_id`,`games_played_rank`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_id_club_unique_idx` ON `player` (`id`,`club_id`);--> statement-breakpoint
CREATE INDEX `player_club_rating_idx` ON `player` (`club_id`,"rating" desc,`rating_deviation`,`id`);