CREATE TABLE `archive_doc_version` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`doc_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`excerpt` text NOT NULL,
	`chars` integer DEFAULT 0 NOT NULL,
	`sheets` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `archive_doc_version_doc_idx` ON `archive_doc_version` (`user_id`,`doc_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `archive_doc` ADD `status` text;--> statement-breakpoint
ALTER TABLE `archive_doc` ADD `status_at` integer;