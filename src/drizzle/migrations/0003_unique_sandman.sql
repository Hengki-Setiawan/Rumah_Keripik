CREATE TABLE `broadcast_campaign` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`pesan` text NOT NULL,
	`target_tags` text DEFAULT '[]',
	`status` text DEFAULT 'draft' NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE TABLE `broadcast_template` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`konten` text NOT NULL,
	`kategori` text DEFAULT 'Lainnya' NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
