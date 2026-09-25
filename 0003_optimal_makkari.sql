CREATE TABLE `multiplayer_matches` (
	`id` varchar(160) NOT NULL,
	`roomId` varchar(128) NOT NULL,
	`hostUserId` int NOT NULL,
	`guestUserId` int NOT NULL,
	`hostScore` int NOT NULL,
	`guestScore` int NOT NULL,
	`winnerUserId` int,
	`hostXp` int NOT NULL,
	`guestXp` int NOT NULL,
	`resultReason` enum('answers','timeout') NOT NULL,
	`completedAt` timestamp NOT NULL,
	CONSTRAINT `multiplayer_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `roundToken` varchar(96) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `roundDeadline` timestamp;