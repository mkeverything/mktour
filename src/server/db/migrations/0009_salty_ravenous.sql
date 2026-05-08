ALTER TABLE `game` ADD `rated_white_id` text REFERENCES player(id);--> statement-breakpoint
ALTER TABLE `game` ADD `rated_black_id` text REFERENCES player(id);