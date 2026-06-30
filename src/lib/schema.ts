import {
  sqliteTable,
  text,
  integer,
  blob,
  index,
  unique,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── PELANGGAN CHATBOT ────────────────────────────────────────────────────────
export const pelangganChatbot = sqliteTable('pelanggan_chatbot', {
  no_wa_pelanggan: text('no_wa_pelanggan').primaryKey(), // WA: 62812..., Telegram: tg_<chat_id>
  nama_pelanggan: text('nama_pelanggan'),
  alamat_pengiriman: text('alamat_pengiriman'),
  channel: text('channel', { enum: ['wa', 'telegram'] })
    .notNull()
    .default('wa'),
  status_handle: text('status_handle', {
    enum: ['AI_Bot', 'Manual_Admin'],
  })
    .notNull()
    .default('AI_Bot'),
  context_sesi: text('context_sesi'), // JSON string
  tags: text('tags').default('[]'), // JSON array: ["VIP","Komplain","Prospek"]
  diambil_oleh: text('diambil_oleh'), // admin user name yang sedang handle chat
  waktu_daftar: text('waktu_daftar')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
  terakhir_aktif: text('terakhir_aktif')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── PRODUK ──────────────────────────────────────────────────────────────────
export const produk = sqliteTable('produk', {
  id_produk: text('id_produk').primaryKey(), // KRP-001
  nama_produk: text('nama_produk').notNull(),
  deskripsi: text('deskripsi'),
  harga_jual: integer('harga_jual').notNull(), // Rupiah
  stok_gudang_utama: integer('stok_gudang_utama').notNull().default(0),
  is_active: integer('is_active').notNull().default(1), // 0 or 1
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── WARUNG RETAIL [v1.1 NEW] ────────────────────────────────────────────────
export const warungRetail = sqliteTable('warung_retail', {
  id_warung: text('id_warung').primaryKey(), // WRG-001
  nama_warung: text('nama_warung').notNull(),
  pemilik: text('pemilik'),
  no_wa_warung: text('no_wa_warung'),
  alamat: text('alamat').notNull(),
  tipe_kemitraan: text('tipe_kemitraan', {
    enum: ['Reseller', 'Agent', 'Dropshipper'],
  })
    .notNull()
    .default('Reseller'),
  min_order_grosir: integer('min_order_grosir').notNull().default(0),
  is_active: integer('is_active').notNull().default(1),
  waktu_daftar: text('waktu_daftar')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── TRANSAKSI ───────────────────────────────────────────────────────────────
export const transaksi = sqliteTable(
  'transaksi',
  {
    id_transaksi: text('id_transaksi').primaryKey(), // TX-20260622-001
    no_wa_pelanggan: text('no_wa_pelanggan').references(
      () => pelangganChatbot.no_wa_pelanggan
    ), // NULLABLE
    id_warung: text('id_warung').references(() => warungRetail.id_warung), // NULLABLE
    tipe_penjualan: text('tipe_penjualan', {
      enum: ['Online_WA', 'Offline_Gudang'],
    })
      .notNull()
      .default('Online_WA'),
    total_bayar: integer('total_bayar').notNull(),
    status_pembayaran: text('status_pembayaran', {
      enum: ['Lunas', 'Piutang', 'Tidak_Lunas'],
    })
      .notNull()
      .default('Lunas'),
    tanggal_jatuh_tempo: text('tanggal_jatuh_tempo'), // Untuk piutang
    kode_pesanan: text('kode_pesanan').unique(), // PESANAN-XXXXXX
    catatan: text('catatan'),
    waktu_simpan: text('waktu_simpan')
      .notNull()
      .default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    statusIdx: index('idx_transaksi_status').on(table.status_pembayaran),
    tanggalIdx: index('idx_transaksi_tanggal').on(table.waktu_simpan),
    warungIdx: index('idx_transaksi_warung').on(table.id_warung),
    validasiTransaksi: check(
      'ck_transaksi_valid',
      sql`(${table.no_wa_pelanggan} IS NOT NULL) OR (${table.id_warung} IS NOT NULL)`
    ),
  })
);

// ─── DETAIL TRANSAKSI ────────────────────────────────────────────────────────
export const detailTransaksi = sqliteTable('detail_transaksi', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  id_transaksi: text('id_transaksi')
    .notNull()
    .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
  id_produk: text('id_produk')
    .notNull()
    .references(() => produk.id_produk, { onDelete: 'restrict' }),
  qty_terjual: integer('qty_terjual').notNull(),
  harga_snapshot: integer('harga_snapshot').notNull(), // Snapshot harga saat transaksi
  subtotal: integer('subtotal').notNull(), // qty × harga_snapshot
});

// ─── PESAN CHAT — PESAN KELUAR (bot/admin/sistem) ─────────────────────────────
export const pesanChat = sqliteTable(
  'pesan_chat',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    no_wa_pelanggan: text('no_wa_pelanggan')
      .notNull()
      .references(() => pelangganChatbot.no_wa_pelanggan),
    channel: text('channel', { enum: ['wa', 'telegram'] })
      .notNull()
      .default('wa'),
    direction: text('direction', { enum: ['in', 'out'] }).notNull(),
    sumber: text('sumber', {
      enum: ['bot', 'admin', 'sistem', 'pelanggan'],
    }).notNull(),
    teks: text('teks').notNull(),
    id_external: text('id_external'), // WA: msg ID, Telegram: message_id
    status_kirim: text('status_kirim', {
      enum: ['sent', 'failed'],
    })
      .notNull()
      .default('sent'),
    timestamp: text('timestamp')
      .notNull()
      .default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    waIdx: index('idx_pesan_wa').on(table.no_wa_pelanggan, table.timestamp),
    sumberIdx: index('idx_pesan_sumber').on(table.sumber),
    uqExternal: unique('uq_pesan_id_external').on(table.id_external),
  })
);

// ─── AI KNOWLEDGE BASE ───────────────────────────────────────────────────────
export const aiKnowledgeBase = sqliteTable('ai_knowledge_base', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  judul: text('judul').notNull(),
  potongan_teks: text('potongan_teks').notNull(),
  kategori: text('kategori'), // FAQ, Produk, Pengiriman, Kebijakan
  vector_embedding: blob('vector_embedding', { mode: 'buffer' }), // Gemini embedding F32 3072 dimensi
  tanggal_upload: text('tanggal_upload')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
  is_active: integer('is_active').notNull().default(1),
});

// ─── BROADCAST CAMPAIGN ───────────────────────────────────────────────────────
export const broadcastCampaign = sqliteTable('broadcast_campaign', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama: text('nama').notNull(),
  pesan: text('pesan').notNull(),
  target_tags: text('target_tags').default('[]'), // JSON array of tags, [] = semua
  status: text('status', { enum: ['draft', 'sent', 'sending'] }).notNull().default('draft'),
  sent_count: integer('sent_count').notNull().default(0),
  total_count: integer('total_count').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  sent_at: text('sent_at'),
});

export const broadcastTemplate = sqliteTable('broadcast_template', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama: text('nama').notNull(),
  konten: text('konten').notNull(),
  kategori: text('kategori', { enum: ['Promo', 'Notifikasi', 'Ucapan', 'Lainnya'] }).notNull().default('Lainnya'),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
});

// ─── BOT AUTO REPLY RULES ──────────────────────────────────────────────────────
export const botAutoReply = sqliteTable('bot_auto_reply', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull(),
  response: text('response').notNull(),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── CHAT LOG ─────────────────────────────────────────────────────────────────
export const chatLog = sqliteTable('chat_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  no_wa_pelanggan: text('no_wa_pelanggan').notNull(),
  channel: text('channel', { enum: ['wa', 'telegram'] })
    .notNull()
    .default('wa'),
  user_message: text('user_message').notNull(),
  bot_response: text('bot_response'),
  sumber: text('sumber', { enum: ['rule', 'groq', 'gemini', 'not_found'] })
    .notNull()
    .default('rule'),
  model_used: text('model_used'),
  tokens_used: integer('tokens_used').default(0),
  timestamp: text('timestamp')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type PelangganChatbot = typeof pelangganChatbot.$inferSelect;
export type InsertPelangganChatbot = typeof pelangganChatbot.$inferInsert;

export type Produk = typeof produk.$inferSelect;
export type InsertProduk = typeof produk.$inferInsert;

export type WarungRetail = typeof warungRetail.$inferSelect;
export type InsertWarungRetail = typeof warungRetail.$inferInsert;

export type Transaksi = typeof transaksi.$inferSelect;
export type InsertTransaksi = typeof transaksi.$inferInsert;

export type DetailTransaksi = typeof detailTransaksi.$inferSelect;
export type InsertDetailTransaksi = typeof detailTransaksi.$inferInsert;

export type PesanChat = typeof pesanChat.$inferSelect;
export type InsertPesanChat = typeof pesanChat.$inferInsert;

export type AiKnowledgeBase = typeof aiKnowledgeBase.$inferSelect;
export type InsertAiKnowledgeBase = typeof aiKnowledgeBase.$inferInsert;

export type BotAutoReply = typeof botAutoReply.$inferSelect;
export type InsertBotAutoReply = typeof botAutoReply.$inferInsert;

export type ChatLog = typeof chatLog.$inferSelect;
export type InsertChatLog = typeof chatLog.$inferInsert;
