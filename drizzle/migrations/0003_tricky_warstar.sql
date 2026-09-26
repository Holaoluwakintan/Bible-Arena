CREATE TABLE `fellowship_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`inviteCode` text NOT NULL,
	`name` text NOT NULL,
	`ownerUserId` integer NOT NULL,
	`privacy` text DEFAULT 'invite_only' NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fellowship_groups_invite_unique` ON `fellowship_groups` (`inviteCode`);--> statement-breakpoint
CREATE INDEX `fellowship_groups_owner_idx` ON `fellowship_groups` (`ownerUserId`);--> statement-breakpoint
CREATE TABLE `fellowship_members` (
	`groupId` text NOT NULL,
	`userId` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joinedAt` integer NOT NULL,
	PRIMARY KEY(`groupId`, `userId`),
	FOREIGN KEY (`groupId`) REFERENCES `fellowship_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fellowship_members_user_idx` ON `fellowship_members` (`userId`,`joinedAt`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`dataJson` text DEFAULT '{}' NOT NULL,
	`readAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`userId`,`readAt`,`createdAt`);