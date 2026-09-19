CREATE TABLE `post_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`reader_id` integer,
	`viewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`searched_at` integer NOT NULL
);
