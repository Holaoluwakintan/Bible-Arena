CREATE TABLE `friend_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`shareCode` text NOT NULL,
	`creatorUserId` integer NOT NULL,
	`opponentUserId` integer,
	`mode` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_challenges_shareCode_unique` ON `friend_challenges` (`shareCode`);--> statement-breakpoint
CREATE TABLE `matchmaking_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`seasonId` text NOT NULL,
	`division` text NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`matchedRoomId` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matchmaking_queue_userId_unique` ON `matchmaking_queue` (`userId`);--> statement-breakpoint
CREATE TABLE `multiplayer_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`seasonId` text DEFAULT 'season-legacy' NOT NULL,
	`hostUserId` integer NOT NULL,
	`guestUserId` integer NOT NULL,
	`hostScore` integer NOT NULL,
	`guestScore` integer NOT NULL,
	`winnerUserId` integer,
	`hostXp` integer NOT NULL,
	`guestXp` integer NOT NULL,
	`resultReason` text NOT NULL,
	`isSuspicious` integer DEFAULT 0 NOT NULL,
	`suspicionReason` text,
	`completedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `multiplayer_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`roomCode` text NOT NULL,
	`hostUserId` integer NOT NULL,
	`guestUserId` integer,
	`mode` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`currentQuestionIndex` integer DEFAULT 0 NOT NULL,
	`hostReady` integer DEFAULT 0 NOT NULL,
	`guestReady` integer DEFAULT 0 NOT NULL,
	`hostAnsweredIndex` integer DEFAULT -1 NOT NULL,
	`guestAnsweredIndex` integer DEFAULT -1 NOT NULL,
	`hostScore` integer DEFAULT 0 NOT NULL,
	`guestScore` integer DEFAULT 0 NOT NULL,
	`winnerUserId` integer,
	`roundToken` text DEFAULT '' NOT NULL,
	`roundDeadline` integer,
	`roomVersion` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `multiplayer_rooms_roomCode_unique` ON `multiplayer_rooms` (`roomCode`);--> statement-breakpoint
CREATE TABLE `player_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`totalXp` integer DEFAULT 0 NOT NULL,
	`currentStreak` integer DEFAULT 0 NOT NULL,
	`bestStreak` integer DEFAULT 0 NOT NULL,
	`lastEligibleDate` text,
	`achievementsJson` text DEFAULT '[]' NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_progress_userId_unique` ON `player_progress` (`userId`);--> statement-breakpoint
CREATE TABLE `session_records` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`mode` text NOT NULL,
	`score` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`correctAnswers` integer NOT NULL,
	`totalQuestions` integer NOT NULL,
	`xpEarned` integer NOT NULL,
	`completedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tournament_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`startsAt` integer NOT NULL,
	`endsAt` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);