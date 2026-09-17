CREATE TABLE `announcement_dismissals` (
	`user_id` text NOT NULL,
	`announcement_id` text NOT NULL,
	`dismissed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `announcement_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
