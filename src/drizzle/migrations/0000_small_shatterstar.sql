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
CREATE TABLE `detail_transaksi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_transaksi` text NOT NULL,
	`id_produk` text NOT NULL,
	`qty_terjual` integer NOT NULL,
	`harga_snapshot` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`id_produk`) REFERENCES `produk`(`id_produk`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pelanggan_chatbot` (
	`no_wa_pelanggan` text PRIMARY KEY NOT NULL,
	`nama_pelanggan` text,
	`alamat_pengiriman` text,
	`status_handle` text DEFAULT 'AI_Bot' NOT NULL,
	`context_sesi` text,
	`waktu_daftar` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	`terakhir_aktif` text DEFAULT (datetime('now', 'utc')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pesan_chat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`no_wa_pelanggan` text NOT NULL,
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
	`waktu_simpan` text DEFAULT (datetime('now', 'utc')) NOT NULL,
	FOREIGN KEY (`no_wa_pelanggan`) REFERENCES `pelanggan_chatbot`(`no_wa_pelanggan`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id_warung`) REFERENCES `warung_retail`(`id_warung`) ON UPDATE no action ON DELETE no action
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
CREATE INDEX `idx_pesan_wa` ON `pesan_chat` (`no_wa_pelanggan`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_pesan_sumber` ON `pesan_chat` (`sumber`);--> statement-breakpoint
CREATE UNIQUE INDEX `transaksi_kode_pesanan_unique` ON `transaksi` (`kode_pesanan`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_status` ON `transaksi` (`status_pembayaran`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_tanggal` ON `transaksi` (`waktu_simpan`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_warung` ON `transaksi` (`id_warung`);