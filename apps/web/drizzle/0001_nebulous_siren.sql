CREATE TABLE `company_boards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ats` text NOT NULL,
	`token` text NOT NULL,
	`company_name` text,
	`discovered_from` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_polled_at` text,
	`job_count` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_boards_ats_token` ON `company_boards` (`ats`,lower("token"));--> statement-breakpoint
ALTER TABLE `jobs` ADD `locations` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `country` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_currency` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_text` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `apply_url` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `board_id` integer REFERENCES company_boards(id);--> statement-breakpoint
ALTER TABLE `jobs` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `last_seen_at` text;