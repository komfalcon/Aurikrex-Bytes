CREATE TABLE `onesignal_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reader_id` integer,
	`subscription_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reader_id`) REFERENCES `readers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onesignal_subscriptions_subscription_id_unique` ON `onesignal_subscriptions` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reader_id` integer,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reader_id`) REFERENCES `readers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `source_publisher` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `source_published_at` integer;--> statement-breakpoint
ALTER TABLE `posts` ADD `duplicate_key` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `image_query` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `image_provenance` text;--> statement-breakpoint
CREATE UNIQUE INDEX `posts_duplicate_key_unique` ON `posts` (`duplicate_key`);--> statement-breakpoint
ALTER TABLE `readers` ADD `feed_view_mode` text DEFAULT 'editorial' NOT NULL;--> statement-breakpoint
ALTER TABLE `readers` ADD `feed_view_onboarding_completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `readers` ADD `avatar_url` text;