CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`remember_device_token` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_url` text,
	`headline` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_time` integer,
	`published_time` integer,
	`created_by` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `readers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`google_id` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`verification_token` text,
	`reset_token` text,
	`reset_token_expires` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `readers_email_unique` ON `readers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `readers_google_id_unique` ON `readers` (`google_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`open_id` text NOT NULL,
	`name` text,
	`email` text,
	`login_method` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_signed_in` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_open_id_unique` ON `users` (`open_id`);