CREATE TABLE `friend_challenges` (
	`id` varchar(128) NOT NULL,
	`shareCode` varchar(6) NOT NULL,
	`creatorUserId` int NOT NULL,
	`opponentUserId` int,
	`mode` varchar(32) NOT NULL,
	`status` enum('open','completed','expired') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `friend_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `friend_challenges_shareCode_unique` UNIQUE(`shareCode`)
);
--> statement-breakpoint
CREATE TABLE `player_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalXp` int NOT NULL DEFAULT 0,
	`currentStreak` int NOT NULL DEFAULT 0,
	`bestStreak` int NOT NULL DEFAULT 0,
	`lastEligibleDate` varchar(10),
	`achievementsJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_progress_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `session_records` (
	`id` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`mode` varchar(32) NOT NULL,
	`score` int NOT NULL,
	`accuracy` int NOT NULL,
	`correctAnswers` int NOT NULL,
	`totalQuestions` int NOT NULL,
	`xpEarned` int NOT NULL,
	`completedAt` timestamp NOT NULL,
	CONSTRAINT `session_records_id` PRIMARY KEY(`id`)
);
