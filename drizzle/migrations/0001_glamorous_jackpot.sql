CREATE TABLE `moderation_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`reporterUserId` integer NOT NULL,
	`subjectUserId` integer,
	`matchId` text,
	`reason` text NOT NULL,
	`evidenceJson` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`createdAt` integer NOT NULL,
	`reviewedAt` integer,
	FOREIGN KEY (`reporterUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subjectUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`matchId`) REFERENCES `multiplayer_matches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `moderation_flags_status_idx` ON `moderation_flags` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `moderation_flags_subject_idx` ON `moderation_flags` (`subjectUserId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`requestedAt` integer NOT NULL,
	`completedAt` integer,
	`resultJson` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_user_idx` ON `privacy_requests` (`userId`,`requestedAt`);--> statement-breakpoint
CREATE TABLE `question_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporterUserId` integer NOT NULL,
	`questionId` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`createdAt` integer NOT NULL,
	`reviewedAt` integer,
	FOREIGN KEY (`reporterUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_reports_question_idx` ON `question_reports` (`questionId`,`status`);--> statement-breakpoint
CREATE INDEX `question_reports_reporter_idx` ON `question_reports` (`reporterUserId`,`createdAt`);