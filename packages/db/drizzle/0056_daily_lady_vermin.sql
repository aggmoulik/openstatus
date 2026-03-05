CREATE TABLE `migration_job` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`provider` text NOT NULL,
	`external_page_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` text,
	`error` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
