ALTER TABLE `admin_users` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `rejection_note` text;