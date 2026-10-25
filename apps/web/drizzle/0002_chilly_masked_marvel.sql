CREATE TABLE `eligibility_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`verdict` text NOT NULL,
	`evidence` text,
	`reason` text NOT NULL,
	`method` text NOT NULL,
	`model` text,
	`prompt_version` text NOT NULL,
	`input_hash` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`latency_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `eligibility_checks_job_id` ON `eligibility_checks` (`job_id`);--> statement-breakpoint
CREATE TABLE `eligibility_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`label` text NOT NULL,
	`note` text,
	`labelled_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eligibility_labels_job_id_unique` ON `eligibility_labels` (`job_id`);--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility_evidence` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility_reason` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility_method` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility_version` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility_input_hash` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `eligibility_checked_at` text;