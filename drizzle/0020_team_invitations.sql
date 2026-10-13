CREATE TABLE `team_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`team_id` text NOT NULL,
	`level` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`revoked_at` integer,
	`acceptance_id` text,
	`consumed_by` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "team_invitation_level" CHECK("team_invitations"."level" IN ('viewer','user','contributor','team_admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitations_token_hash_unique` ON `team_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `team_invitations_pending` ON `team_invitations` (`team_id`,`email`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitations_one_pending` ON `team_invitations` (`team_id`,`email`) WHERE "team_invitations"."used_at" IS NULL AND "team_invitations"."revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);