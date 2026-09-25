CREATE TABLE `friend_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`shareCode` text NOT NULL,
	`creatorUserId` integer NOT NULL,
	`opponentUserId` integer,
	`mode` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`creatorUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opponentUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_challenges_shareCode_unique` ON `friend_challenges` (`shareCode`);--> statement-breakpoint
CREATE INDEX `friend_challenges_creator_idx` ON `friend_challenges` (`creatorUserId`);--> statement-breakpoint
CREATE INDEX `friend_challenges_opponent_idx` ON `friend_challenges` (`opponentUserId`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requesterId` integer NOT NULL,
	`addresseeId` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`requesterId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addresseeId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair_unique` ON `friendships` (`requesterId`,`addresseeId`);--> statement-breakpoint
CREATE INDEX `friendships_requester_idx` ON `friendships` (`requesterId`);--> statement-breakpoint
CREATE INDEX `friendships_addressee_idx` ON `friendships` (`addresseeId`);--> statement-breakpoint
CREATE TABLE `matchmaking_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`seasonId` text NOT NULL,
	`division` text NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`matchedRoomId` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`matchedRoomId`) REFERENCES `multiplayer_rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matchmaking_queue_userId_unique` ON `matchmaking_queue` (`userId`);--> statement-breakpoint
CREATE INDEX `matchmaking_queue_status_idx` ON `matchmaking_queue` (`status`,`expiresAt`);--> statement-breakpoint
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
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`roomId`) REFERENCES `multiplayer_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hostUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guestUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winnerUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `multiplayer_matches_room_idx` ON `multiplayer_matches` (`roomId`);--> statement-breakpoint
CREATE INDEX `multiplayer_matches_host_idx` ON `multiplayer_matches` (`hostUserId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `multiplayer_matches_guest_idx` ON `multiplayer_matches` (`guestUserId`,`completedAt`);--> statement-breakpoint
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
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`hostUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guestUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winnerUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `multiplayer_rooms_roomCode_unique` ON `multiplayer_rooms` (`roomCode`);--> statement-breakpoint
CREATE INDEX `multiplayer_rooms_host_idx` ON `multiplayer_rooms` (`hostUserId`);--> statement-breakpoint
CREATE INDEX `multiplayer_rooms_guest_idx` ON `multiplayer_rooms` (`guestUserId`);--> statement-breakpoint
CREATE TABLE `player_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`totalXp` integer DEFAULT 0 NOT NULL,
	`currentStreak` integer DEFAULT 0 NOT NULL,
	`bestStreak` integer DEFAULT 0 NOT NULL,
	`lastEligibleDate` text,
	`achievementsJson` text DEFAULT '[]' NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "player_progress_xp_check" CHECK("player_progress"."totalXp" >= 0),
	CONSTRAINT "player_progress_streak_check" CHECK("player_progress"."currentStreak" >= 0 AND "player_progress"."bestStreak" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_progress_userId_unique` ON `player_progress` (`userId`);--> statement-breakpoint
CREATE TABLE `player_season_rewards` (
	`userId` integer NOT NULL,
	`seasonId` text NOT NULL,
	`rewardId` text NOT NULL,
	`claimedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `seasonId`, `rewardId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_season_rewards_user_idx` ON `player_season_rewards` (`userId`);--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`token` text NOT NULL,
	`platform` text,
	`dailyReminders` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_tokens_token_unique` ON `push_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `push_tokens_user_idx` ON `push_tokens` (`userId`);--> statement-breakpoint
CREATE TABLE `session_records` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`mode` text NOT NULL,
	`score` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`correctAnswers` integer NOT NULL,
	`totalQuestions` integer NOT NULL,
	`xpEarned` integer NOT NULL,
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "session_records_score_check" CHECK("session_records"."score" >= 0),
	CONSTRAINT "session_records_accuracy_check" CHECK("session_records"."accuracy" BETWEEN 0 AND 100),
	CONSTRAINT "session_records_answers_check" CHECK("session_records"."correctAnswers" BETWEEN 0 AND "session_records"."totalQuestions" AND "session_records"."totalQuestions" > 0),
	CONSTRAINT "session_records_xp_check" CHECK("session_records"."xpEarned" >= 0)
);
--> statement-breakpoint
CREATE INDEX `session_records_user_completed_idx` ON `session_records` (`userId`,`completedAt`);--> statement-breakpoint
CREATE TABLE `tournament_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`startsAt` integer NOT NULL,
	`endsAt` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tournament_seasons_status_idx` ON `tournament_seasons` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('user', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);