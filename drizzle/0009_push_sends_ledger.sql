CREATE TABLE IF NOT EXISTS `push_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_date` text NOT NULL,
	`slot` text NOT NULL,
	`status` text NOT NULL,
	`trigger_source` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`lead_post_id` integer,
	`posts_count` integer,
	`recipients_count` integer,
	`onesignal_notification_ids` text,
	`invalid_removed_count` integer,
	`error` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`lead_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `push_sends_edition_slot_unique` ON `push_sends` (`edition_date`, `slot`);
