CREATE TABLE `matchmaking_queue` (
	`id` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`seasonId` varchar(64) NOT NULL,
	`division` varchar(32) NOT NULL,
	`rating` int NOT NULL DEFAULT 0,
	`status` enum('waiting','matched','expired') NOT NULL DEFAULT 'waiting',
	`matchedRoomId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `matchmaking_queue_id` PRIMARY KEY(`id`),
	CONSTRAINT `matchmaking_queue_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `multiplayer_matches` ADD `isSuspicious` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_matches` ADD `suspicionReason` text;