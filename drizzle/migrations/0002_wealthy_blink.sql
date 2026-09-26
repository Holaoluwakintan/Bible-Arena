CREATE TABLE `friend_challenge_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`challengeId` text NOT NULL,
	`userId` integer NOT NULL,
	`sessionId` text NOT NULL,
	`score` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`challengeId`) REFERENCES `friend_challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `session_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_challenge_turns_challenge_user_unique` ON `friend_challenge_turns` (`challengeId`,`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `friend_challenge_turns_session_unique` ON `friend_challenge_turns` (`sessionId`);--> statement-breakpoint
CREATE INDEX `friend_challenge_turns_challenge_idx` ON `friend_challenge_turns` (`challengeId`,`completedAt`);