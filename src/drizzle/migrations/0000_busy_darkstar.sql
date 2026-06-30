CREATE TABLE `ai_knowledge_base` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`judul` text NOT NULL,
	`potongan_teks` text NOT NULL,
	`kategori` text,
	`vector_embedding` blob,
	`tanggal_upload` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bot_auto_reply` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`response` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `bukti_pembayaran` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_transaksi` text NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`url_gambar` text NOT NULL,
	`base64_data` text,
	`mimetype` text DEFAULT 'image/jpeg',
	`caption` text,
	`status_verifikasi` text DEFAULT 'Menunggu' NOT NULL,
	`diverifikasi_oleh` text,
	`catatan_admin` text,
	`waktu_upload` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`waktu_verifikasi` text,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`channel` text DEFAULT 'wa' NOT NULL,
	`user_message` text NOT NULL,
	`bot_response` text,
	`sumber` text DEFAULT 'rule' NOT NULL,
	`model_used` text,
	`tokens_used` integer DEFAULT 0,
	`timestamp` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `detail_transaksi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_transaksi` text NOT NULL,
	`id_produk` text NOT NULL,
	`qty_terjual` integer NOT NULL,
	`harga_snapshot` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`id_produk`) REFERENCES `produk`(`id_produk`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `lokasi_pelanggan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`lat` text NOT NULL,
	`lng` text NOT NULL,
	`alamat_teks` text,
	`source` text NOT NULL,
	`accuracy_meter` integer,
	`is_verified` integer DEFAULT 0 NOT NULL,
	`id_transaksi` text,
	`catatan` text,
	`timestamp` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`no_wa_pelanggan`) REFERENCES `pelanggan_chatbot`(`no_wa_pelanggan`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memory_pelanggan` (
	`no_wa_pelanggan` text PRIMARY KEY NOT NULL,
	`produk_favorit` text DEFAULT '[]',
	`alamat_tersimpan` text DEFAULT '[]',
	`avg_order_value` integer DEFAULT 0,
	`total_order` integer DEFAULT 0,
	`avg_rating` integer DEFAULT 0,
	`tags_preferensi` text DEFAULT '[]',
	`last_order_id` text,
	`last_order_date` text,
	`waitlist_produk` text DEFAULT '[]',
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`no_wa_pelanggan`) REFERENCES `pelanggan_chatbot`(`no_wa_pelanggan`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pelanggan_chatbot` (
	`no_wa_pelanggan` text PRIMARY KEY NOT NULL,
	`nama_pelanggan` text,
	`alamat_pengiriman` text,
	`channel` text DEFAULT 'wa' NOT NULL,
	`status_handle` text DEFAULT 'AI_Bot' NOT NULL,
	`context_sesi` text,
	`tags` text DEFAULT '[]',
	`diambil_oleh` text,
	`waktu_daftar` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`terakhir_aktif` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pesan_chat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`channel` text DEFAULT 'wa' NOT NULL,
	`direction` text NOT NULL,
	`sumber` text NOT NULL,
	`teks` text NOT NULL,
	`id_external` text,
	`status_kirim` text DEFAULT 'sent' NOT NULL,
	`timestamp` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`no_wa_pelanggan`) REFERENCES `pelanggan_chatbot`(`no_wa_pelanggan`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `produk` (
	`id_produk` text PRIMARY KEY NOT NULL,
	`nama_produk` text NOT NULL,
	`deskripsi` text,
	`harga_jual` integer NOT NULL,
	`stok_gudang_utama` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rating_pelanggan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`id_transaksi` text,
	`rating` integer NOT NULL,
	`feedback_text` text,
	`timestamp` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`judul` text NOT NULL,
	`trigger_pattern` text NOT NULL,
	`response_template` text NOT NULL,
	`success_count` integer DEFAULT 1 NOT NULL,
	`avg_rating` integer DEFAULT 0,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaksi` (
	`id_transaksi` text PRIMARY KEY NOT NULL,
	`no_wa_pelanggan` text,
	`id_warung` text,
	`tipe_penjualan` text DEFAULT 'Online_WA' NOT NULL,
	`total_bayar` integer NOT NULL,
	`status_pembayaran` text DEFAULT 'Lunas' NOT NULL,
	`tanggal_jatuh_tempo` text,
	`kode_pesanan` text,
	`catatan` text,
	`nama_penerima` text,
	`alamat_penerima` text,
	`no_hp_penerima` text,
	`bukti_transfer_url` text,
	`sumber_order` text DEFAULT 'Offline',
	`lat_pengiriman` text,
	`lng_pengiriman` text,
	`jarak_km_dari_gudang` text,
	`waktu_simpan` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`no_wa_pelanggan`) REFERENCES `pelanggan_chatbot`(`no_wa_pelanggan`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id_warung`) REFERENCES `warung_retail`(`id_warung`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `waitlist_produk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
	`id_produk` text NOT NULL,
	`channel` text DEFAULT 'wa' NOT NULL,
	`sudah_dinotif` integer DEFAULT 0 NOT NULL,
	`waktu_daftar` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`no_wa_pelanggan`) REFERENCES `pelanggan_chatbot`(`no_wa_pelanggan`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id_produk`) REFERENCES `produk`(`id_produk`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `warung_retail` (
	`id_warung` text PRIMARY KEY NOT NULL,
	`nama_warung` text NOT NULL,
	`pemilik` text,
	`no_wa_warung` text,
	`alamat` text NOT NULL,
	`tipe_kemitraan` text DEFAULT 'Reseller' NOT NULL,
	`min_order_grosir` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`waktu_daftar` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `zona_pengiriman` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama_zona` text NOT NULL,
	`lat_pusat` text NOT NULL,
	`lng_pusat` text NOT NULL,
	`radius_km` integer DEFAULT 5 NOT NULL,
	`ongkir_min` integer DEFAULT 0 NOT NULL,
	`ongkir_max` integer DEFAULT 0 NOT NULL,
	`total_order_bulan_ini` integer DEFAULT 0,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pesan_wa` ON `pesan_chat` (`no_wa_pelanggan`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_pesan_sumber` ON `pesan_chat` (`sumber`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pesan_id_external` ON `pesan_chat` (`id_external`);--> statement-breakpoint
CREATE UNIQUE INDEX `transaksi_kode_pesanan_unique` ON `transaksi` (`kode_pesanan`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_status` ON `transaksi` (`status_pembayaran`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_tanggal` ON `transaksi` (`waktu_simpan`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_warung` ON `transaksi` (`id_warung`);