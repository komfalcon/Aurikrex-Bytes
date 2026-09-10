ALTER TABLE `readers` ADD COLUMN `feed_view_mode` text DEFAULT 'editorial' NOT NULL;--> statement-breakpoint
ALTER TABLE `readers` ADD COLUMN `feed_view_onboarding_completed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint

