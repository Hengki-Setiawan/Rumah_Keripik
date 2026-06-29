CREATE TABLE `bot_auto_reply` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`response` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`user_message` text NOT NULL,
	`bot_response` text,
	`sumber` text DEFAULT 'rule' NOT NULL,
	`model_used` text,
	`tokens_used` integer DEFAULT 0,
	`timestamp` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
/*
 SQLite does not support "Dropping foreign key" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pesan_id_external` ON `pesan_chat` (`id_external`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/