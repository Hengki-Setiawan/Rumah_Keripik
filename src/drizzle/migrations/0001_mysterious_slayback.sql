CREATE TABLE `produk_kategori` (
	`id_kategori` text PRIMARY KEY NOT NULL,
	`nama_kategori` text NOT NULL,
	`slug` text NOT NULL,
	`deskripsi` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `produk_varian` (
	`id_varian` text PRIMARY KEY NOT NULL,
	`id_produk` text NOT NULL,
	`sku` text,
	`nama_varian` text NOT NULL,
	`rasa` text,
	`ukuran` text,
	`berat_gram` integer,
	`harga_jual` integer NOT NULL,
	`stok` integer DEFAULT 0 NOT NULL,
	`cloudinary_public_id` text,
	`image_url` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_produk`) REFERENCES `produk`(`id_produk`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `produk_media` (
	`id_media` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_produk` text NOT NULL,
	`id_varian` text,
	`cloudinary_public_id` text NOT NULL,
	`secure_url` text,
	`media_type` text DEFAULT 'image' NOT NULL,
	`alt_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_produk`) REFERENCES `produk`(`id_produk`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`id_varian`) REFERENCES `produk_varian`(`id_varian`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customer_profile` (
	`id_customer` text PRIMARY KEY NOT NULL,
	`nama` text,
	`phone` text,
	`email` text,
	`default_address_id` integer,
	`notes` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`last_active_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_identity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_customer` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_customer`) REFERENCES `customer_profile`(`id_customer`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customer_address` (
	`id_address` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_customer` text NOT NULL,
	`label` text,
	`recipient_name` text,
	`phone` text,
	`address_text` text NOT NULL,
	`province` text,
	`city` text,
	`district` text,
	`postal_code` text,
	`latitude` text,
	`longitude` text,
	`location_accuracy` integer,
	`location_source` text,
	`landmark` text,
	`courier_note` text,
	`is_default` integer DEFAULT 0 NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_customer`) REFERENCES `customer_profile`(`id_customer`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `web_order_session` (
	`id_session` text PRIMARY KEY NOT NULL,
	`anonymous_token` text NOT NULL,
	`id_customer` text,
	`current_state` text DEFAULT 'START' NOT NULL,
	`cart_json` text DEFAULT '{}' NOT NULL,
	`context_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_event_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_customer`) REFERENCES `customer_profile`(`id_customer`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `web_chat_message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_session` text NOT NULL,
	`direction` text NOT NULL,
	`message_type` text NOT NULL,
	`text` text,
	`payload_json` text,
	`action_json` text,
	`model_used` text,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_session`) REFERENCES `web_order_session`(`id_session`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payment_proof` (
	`id_payment_proof` text PRIMARY KEY NOT NULL,
	`id_transaksi` text NOT NULL,
	`cloudinary_public_id` text NOT NULL,
	`secure_url` text NOT NULL,
	`original_filename` text,
	`file_format` text,
	`file_size_bytes` integer,
	`amount_claimed` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`uploaded_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`admin_note` text,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payment_method` (
	`id_payment_method` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`account_name` text,
	`account_number` text,
	`bank_name` text,
	`qris_public_id` text,
	`qris_image_url` text,
	`note` text,
	`min_order_total` integer,
	`max_order_total` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_intent` (
	`id_payment_intent` text PRIMARY KEY NOT NULL,
	`id_transaksi` text NOT NULL,
	`id_payment_method` text,
	`method_type` text NOT NULL,
	`amount_due` integer NOT NULL,
	`status` text DEFAULT 'instruction_shown' NOT NULL,
	`instruction_json` text,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`id_payment_method`) REFERENCES `payment_method`(`id_payment_method`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_transaksi` text NOT NULL,
	`order_status` text,
	`payment_status` text,
	`event_type` text NOT NULL,
	`note` text,
	`actor` text DEFAULT 'system' NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `failed_conversation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`id_session` text,
	`no_wa_pelanggan` text,
	`user_message` text NOT NULL,
	`current_state` text,
	`reason` text NOT NULL,
	`raw_ai_output` text,
	`model_used` text,
	`resolved` integer DEFAULT 0 NOT NULL,
	`admin_note` text,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE TABLE `bot_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `bot_menu_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`surface` text DEFAULT 'public_ordering' NOT NULL,
	`label` text NOT NULL,
	`action` text NOT NULL,
	`value` text,
	`payload_json` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `produk` ADD `slug` text;
--> statement-breakpoint
ALTER TABLE `produk` ADD `kategori_id` text REFERENCES produk_kategori(id_kategori);
--> statement-breakpoint
ALTER TABLE `produk` ADD `berat_gram` integer;
--> statement-breakpoint
ALTER TABLE `produk` ADD `cloudinary_public_id` text;
--> statement-breakpoint
ALTER TABLE `produk` ADD `image_url` text;
--> statement-breakpoint
ALTER TABLE `produk` ADD `image_alt` text;
--> statement-breakpoint
ALTER TABLE `produk` ADD `tags_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `produk` ADD `is_featured` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `produk` ADD `is_best_seller` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `produk` ADD `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `produk` ADD `created_at` text DEFAULT '1970-01-01 00:00:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE `detail_transaksi` ADD `id_varian` text REFERENCES produk_varian(id_varian);
--> statement-breakpoint
ALTER TABLE `detail_transaksi` ADD `nama_produk_snapshot` text;
--> statement-breakpoint
ALTER TABLE `detail_transaksi` ADD `nama_varian_snapshot` text;
--> statement-breakpoint
ALTER TABLE `detail_transaksi` ADD `berat_gram_snapshot` integer;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `id_customer` text REFERENCES customer_profile(id_customer);
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `id_session` text REFERENCES web_order_session(id_session);
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `id_address` integer REFERENCES customer_address(id_address);
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `invoice_url` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `order_status` text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `payment_method` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `status_token` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `shipping_address_snapshot` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `shipping_location_json` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `admin_note` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `verified_by` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `verified_at` text;
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `updated_at` text DEFAULT '1970-01-01 00:00:00' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `produk_kategori_slug_unique` ON `produk_kategori` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_produk_kategori_active_sort` ON `produk_kategori` (`is_active`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_produk_kategori_slug` ON `produk_kategori` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `produk_varian_sku_unique` ON `produk_varian` (`sku`);
--> statement-breakpoint
CREATE INDEX `idx_varian_produk_active` ON `produk_varian` (`id_produk`,`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_varian_sku` ON `produk_varian` (`sku`);
--> statement-breakpoint
CREATE INDEX `idx_varian_stock` ON `produk_varian` (`is_active`,`stok`);
--> statement-breakpoint
CREATE INDEX `idx_produk_media_produk` ON `produk_media` (`id_produk`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_produk_media_varian` ON `produk_media` (`id_varian`);
--> statement-breakpoint
CREATE INDEX `idx_produk_media_primary` ON `produk_media` (`id_produk`,`is_primary`);
--> statement-breakpoint
CREATE INDEX `idx_customer_phone` ON `customer_profile` (`phone`);
--> statement-breakpoint
CREATE INDEX `idx_customer_last_active` ON `customer_profile` (`last_active_at`);
--> statement-breakpoint
CREATE INDEX `idx_customer_identity_customer` ON `customer_identity` (`id_customer`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_customer_identity_provider_external` ON `customer_identity` (`provider`,`external_id`);
--> statement-breakpoint
CREATE INDEX `idx_customer_address_customer` ON `customer_address` (`id_customer`,`last_used_at`);
--> statement-breakpoint
CREATE INDEX `idx_customer_address_default` ON `customer_address` (`id_customer`,`is_default`);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_order_session_anonymous_token_unique` ON `web_order_session` (`anonymous_token`);
--> statement-breakpoint
CREATE INDEX `idx_web_order_session_token` ON `web_order_session` (`anonymous_token`);
--> statement-breakpoint
CREATE INDEX `idx_web_order_session_customer` ON `web_order_session` (`id_customer`);
--> statement-breakpoint
CREATE INDEX `idx_web_order_session_status` ON `web_order_session` (`status`,`last_event_at`);
--> statement-breakpoint
CREATE INDEX `idx_web_chat_message_session_time` ON `web_chat_message` (`id_session`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_web_chat_message_type` ON `web_chat_message` (`message_type`);
--> statement-breakpoint
CREATE INDEX `idx_payment_proof_transaksi` ON `payment_proof` (`id_transaksi`);
--> statement-breakpoint
CREATE INDEX `idx_payment_proof_status_time` ON `payment_proof` (`status`,`uploaded_at`);
--> statement-breakpoint
CREATE INDEX `idx_payment_method_active` ON `payment_method` (`is_active`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_payment_method_type` ON `payment_method` (`type`);
--> statement-breakpoint
CREATE INDEX `idx_payment_intent_transaksi` ON `payment_intent` (`id_transaksi`);
--> statement-breakpoint
CREATE INDEX `idx_payment_intent_status` ON `payment_intent` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_order_status_history_transaksi` ON `order_status_history` (`id_transaksi`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_order_status_history_event` ON `order_status_history` (`event_type`);
--> statement-breakpoint
CREATE INDEX `idx_failed_conversation_created` ON `failed_conversation` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_failed_conversation_reason` ON `failed_conversation` (`reason`);
--> statement-breakpoint
CREATE INDEX `idx_failed_conversation_resolved` ON `failed_conversation` (`resolved`);
--> statement-breakpoint
CREATE INDEX `idx_bot_menu_surface_active` ON `bot_menu_item` (`surface`,`is_active`,`sort_order`);
--> statement-breakpoint
CREATE UNIQUE INDEX `produk_slug_unique` ON `produk` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_produk_active_kategori` ON `produk` (`is_active`,`kategori_id`);
--> statement-breakpoint
CREATE INDEX `idx_produk_slug` ON `produk` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_produk_featured` ON `produk` (`is_active`,`is_featured`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_produk_best_seller` ON `produk` (`is_active`,`is_best_seller`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_transaksi_order_status` ON `transaksi` (`order_status`);
--> statement-breakpoint
CREATE INDEX `idx_transaksi_payment_status` ON `transaksi` (`payment_status`);
