ALTER TABLE `readers` ADD `current_streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `readers` ADD `longest_streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `readers` ADD `last_active_date` text;
