CREATE TABLE `tournament_seasons` (
	`id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('active','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tournament_seasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `multiplayer_matches` ADD `seasonId` varchar(64) DEFAULT 'season-legacy' NOT NULL;