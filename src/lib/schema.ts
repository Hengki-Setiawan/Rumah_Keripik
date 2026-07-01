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
      enum: ['Lunas', 'Piutang', 'Tidak_Lunas', 'Menunggu_Verifikasi', 'Menunggu_Bayar', 'Dibatalkan'],
    })
      .notNull()
      .default('Lunas'),
    tanggal_jatuh_tempo: text('tanggal_jatuh_tempo'), // Untuk piutang
    kode_pesanan: text('kode_pesanan').unique(), // PESANAN-XXXXXX
    catatan: text('catatan'),
    
    // NEW: Delivery & Location details
    nama_penerima: text('nama_penerima'),
    alamat_penerima: text('alamat_penerima'),
    no_hp_penerima: text('no_hp_penerima'),
    bukti_transfer_url: text('bukti_transfer_url'),
    sumber_order: text('sumber_order', {
      enum: ['WA', 'Telegram', 'Offline'],
    }).default('Offline'),
    lat_pengiriman: text('lat_pengiriman'),
    lng_pengiriman: text('lng_pengiriman'),
    jarak_km_dari_gudang: text('jarak_km_dari_gudang'), // As real/string number
    invoice_url: text('invoice_url'), // Link invoice Cloudinary
    
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

// ─── MEMORY PELANGGAN ─────────────────────────────────────────────────────────
export const memoryPelanggan = sqliteTable('memory_pelanggan', {
  no_wa_pelanggan: text('no_wa_pelanggan')
    .primaryKey()
    .references(() => pelangganChatbot.no_wa_pelanggan),
  produk_favorit: text('produk_favorit').default('[]'),   // JSON: ["KRP-001", "KRP-003"]
  alamat_tersimpan: text('alamat_tersimpan').default('[]'), // JSON: [{ label, alamat }]
  avg_order_value: integer('avg_order_value').default(0),
  total_order: integer('total_order').default(0),
  avg_rating: integer('avg_rating').default(0),          // × 10, jadi 45 = 4.5 bintang
  tags_preferensi: text('tags_preferensi').default('[]'), // JSON: ["pedas","original"]
  last_order_id: text('last_order_id'),
  last_order_date: text('last_order_date'),
  waitlist_produk: text('waitlist_produk').default('[]'), // JSON: ["KRP-005"] stok habis
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── BUKTI PEMBAYARAN ─────────────────────────────────────────────────────────
export const buktiPembayaran = sqliteTable('bukti_pembayaran', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  id_transaksi: text('id_transaksi')
    .notNull()
    .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
  no_wa_pelanggan: text('no_wa_pelanggan').notNull(),
  url_gambar: text('url_gambar').notNull(),          // '/uploads/bukti/TX-xxx.jpg'
  base64_data: text('base64_data'),                  // Opsional: simpan base64 jika < 500KB
  mimetype: text('mimetype').default('image/jpeg'),
  caption: text('caption'),                          // Caption dari WA
  status_verifikasi: text('status_verifikasi', {
    enum: ['Menunggu', 'Diterima', 'Ditolak'],
  }).notNull().default('Menunggu'),
  diverifikasi_oleh: text('diverifikasi_oleh'),     // Admin username
  catatan_admin: text('catatan_admin'),
  waktu_upload: text('waktu_upload')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
  waktu_verifikasi: text('waktu_verifikasi'),
});

// ─── WAITLIST PRODUK ─────────────────────────────────────────────────────────
export const waitlistProduk = sqliteTable('waitlist_produk', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  no_wa_pelanggan: text('no_wa_pelanggan')
    .notNull()
    .references(() => pelangganChatbot.no_wa_pelanggan),
  id_produk: text('id_produk')
    .notNull()
    .references(() => produk.id_produk),
  channel: text('channel', { enum: ['wa', 'telegram'] }).notNull().default('wa'),
  sudah_dinotif: integer('sudah_dinotif').notNull().default(0), // 0=belum, 1=sudah
  waktu_daftar: text('waktu_daftar')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── RATING PELANGGAN ─────────────────────────────────────────────────────────
export const ratingPelanggan = sqliteTable('rating_pelanggan', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  no_wa_pelanggan: text('no_wa_pelanggan').notNull(),
  id_transaksi: text('id_transaksi'),
  rating: integer('rating').notNull(),              // 1-5
  feedback_text: text('feedback_text'),
  timestamp: text('timestamp')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── SKILL LIBRARY ────────────────────────────────────────────
export const skillLibrary = sqliteTable('skill_library', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  judul: text('judul').notNull(),
  trigger_pattern: text('trigger_pattern').notNull(),   // Pattern pesan user
  response_template: text('response_template').notNull(), // Pola balasan terbaik
  success_count: integer('success_count').notNull().default(1),
  avg_rating: integer('avg_rating').default(0),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── LOKASI PELANGGAN (HISTORY KOORDINAT) ─────────────────────────────────────
export const lokasiPelanggan = sqliteTable('lokasi_pelanggan', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  no_wa_pelanggan: text('no_wa_pelanggan')
    .notNull()
    .references(() => pelangganChatbot.no_wa_pelanggan),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
  alamat_teks: text('alamat_teks'),
  source: text('source', {
    enum: ['wa_native', 'wa_live', 'maps_link', 'maps_short', 'geocoded', 'manual'],
  }).notNull(),
  accuracy_meter: integer('accuracy_meter'),
  is_verified: integer('is_verified').notNull().default(0),
  id_transaksi: text('id_transaksi'),
  catatan: text('catatan'),
  timestamp: text('timestamp')
    .notNull()
    .default(sql`(datetime('now', 'utc'))`),
});

// ─── ZONA PENGIRIMAN ─────────────────────────────────────────────────────────
export const zonaPengiriman = sqliteTable('zona_pengiriman', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nama_zona: text('nama_zona').notNull(),
  lat_pusat: text('lat_pusat').notNull(),
  lng_pusat: text('lng_pusat').notNull(),
  radius_km: integer('radius_km').notNull().default(5),
  ongkir_min: integer('ongkir_min').notNull().default(0),
  ongkir_max: integer('ongkir_max').notNull().default(0),
  total_order_bulan_ini: integer('total_order_bulan_ini').default(0),
  is_active: integer('is_active').notNull().default(1),
});

// Queue draft pemesanan sebelum menjadi transaksi final.
export const orderDraft = sqliteTable(
  'order_draft',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    no_wa_pelanggan: text('no_wa_pelanggan')
      .notNull()
      .references(() => pelangganChatbot.no_wa_pelanggan),
    channel: text('channel', { enum: ['wa', 'telegram'] }).notNull().default('wa'),
    status: text('status', {
      enum: ['Profil_Pending', 'Cart_Pending', 'Menunggu_Bayar', 'Menunggu_Verifikasi', 'Completed', 'Cancelled'],
    }).notNull().default('Profil_Pending'),
    id_transaksi: text('id_transaksi'),
    context_json: text('context_json').notNull(),
    expires_at: text('expires_at'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    customerIdx: index('idx_order_draft_customer').on(table.no_wa_pelanggan),
    statusIdx: index('idx_order_draft_status').on(table.status),
  })
);

export const orderEvents = sqliteTable(
  'order_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_transaksi: text('id_transaksi'),
    no_wa_pelanggan: text('no_wa_pelanggan').notNull(),
    event_type: text('event_type').notNull(),
    event_payload: text('event_payload'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    txIdx: index('idx_order_events_tx').on(table.id_transaksi),
    customerIdx: index('idx_order_events_customer').on(table.no_wa_pelanggan),
  })
);

export const workerJob = sqliteTable(
  'worker_job',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    payload_json: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] })
      .notNull()
      .default('pending'),
    priority: integer('priority').notNull().default(5),
    attempts: integer('attempts').notNull().default(0),
    max_attempts: integer('max_attempts').notNull().default(3),
    locked_by: text('locked_by'),
    locked_until: text('locked_until'),
    result_json: text('result_json'),
    error_message: text('error_message'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    statusIdx: index('idx_worker_job_status').on(table.status, table.priority, table.created_at),
    lockIdx: index('idx_worker_job_lock').on(table.locked_until),
  })
);

export const workerHeartbeat = sqliteTable('worker_heartbeat', {
  worker_id: text('worker_id').primaryKey(),
  worker_name: text('worker_name'),
  status: text('status', { enum: ['online', 'idle', 'offline'] }).notNull().default('online'),
  last_seen_at: text('last_seen_at').notNull().default(sql`(datetime('now', 'utc'))`),
  meta_json: text('meta_json'),
});

export const outboundMessageQueue = sqliteTable(
  'outbound_message_queue',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel: text('channel', { enum: ['wa', 'telegram'] }).notNull(),
    recipient_id: text('recipient_id').notNull(),
    message_text: text('message_text').notNull(),
    status: text('status', { enum: ['pending', 'sent', 'failed', 'cancelled'] }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    provider_message_id: text('provider_message_id'),
    error_message: text('error_message'),
    scheduled_at: text('scheduled_at'),
    sent_at: text('sent_at'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    statusIdx: index('idx_outbound_queue_status').on(table.status, table.scheduled_at),
  })
);

export const geocodeCache = sqliteTable('geocode_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  query: text('query').notNull().unique(),
  lat: text('lat'),
  lng: text('lng'),
  formatted_address: text('formatted_address'),
  provider: text('provider').notNull().default('nominatim'),
  confidence: integer('confidence'),
  raw_json: text('raw_json'),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
});

export const aiResponseCache = sqliteTable('ai_response_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cache_key: text('cache_key').notNull().unique(),
  prompt_hash: text('prompt_hash').notNull(),
  response_text: text('response_text').notNull(),
  model_used: text('model_used'),
  tokens_used: integer('tokens_used').default(0),
  expires_at: text('expires_at'),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
});

export const aiLearningReview = sqliteTable('ai_learning_review', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trigger_pattern: text('trigger_pattern').notNull(),
  suggested_response: text('suggested_response').notNull(),
  source_chat_id: integer('source_chat_id'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  reviewed_by: text('reviewed_by'),
  reviewed_at: text('reviewed_at'),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
});

export const deliveryAssignment = sqliteTable(
  'delivery_assignment',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    kurir_name: text('kurir_name'),
    status: text('status', {
      enum: ['Siap_Dikirim', 'Dalam_Pengiriman', 'Terkirim', 'Gagal'],
    }).notNull().default('Siap_Dikirim'),
    pickup_at: text('pickup_at'),
    delivered_at: text('delivered_at'),
    proof_url: text('proof_url'),
    notes: text('notes'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    txIdx: index('idx_delivery_assignment_tx').on(table.id_transaksi),
    statusIdx: index('idx_delivery_assignment_status').on(table.status),
  })
);

export const deliveryRoutePoint = sqliteTable(
  'delivery_route_point',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    route_date: text('route_date').notNull(),
    id_transaksi: text('id_transaksi').notNull(),
    sequence_no: integer('sequence_no').notNull(),
    lat: text('lat').notNull(),
    lng: text('lng').notNull(),
    address: text('address'),
    status: text('status', { enum: ['pending', 'visited', 'skipped'] }).notNull().default('pending'),
  },
  (table) => ({
    routeIdx: index('idx_delivery_route_date').on(table.route_date, table.sequence_no),
  })
);

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

export type MemoryPelanggan = typeof memoryPelanggan.$inferSelect;
export type InsertMemoryPelanggan = typeof memoryPelanggan.$inferInsert;

export type BuktiPembayaran = typeof buktiPembayaran.$inferSelect;
export type InsertBuktiPembayaran = typeof buktiPembayaran.$inferInsert;

export type WaitlistProduk = typeof waitlistProduk.$inferSelect;
export type InsertWaitlistProduk = typeof waitlistProduk.$inferInsert;

export type RatingPelanggan = typeof ratingPelanggan.$inferSelect;
export type InsertRatingPelanggan = typeof ratingPelanggan.$inferInsert;

export type SkillLibrary = typeof skillLibrary.$inferSelect;
export type InsertSkillLibrary = typeof skillLibrary.$inferInsert;

export type ZonaPengiriman = typeof zonaPengiriman.$inferSelect;
export type InsertZonaPengiriman = typeof zonaPengiriman.$inferInsert;

export type LokasiPelanggan = typeof lokasiPelanggan.$inferSelect;
export type InsertLokasiPelanggan = typeof lokasiPelanggan.$inferInsert;

export type OrderDraft = typeof orderDraft.$inferSelect;
export type InsertOrderDraft = typeof orderDraft.$inferInsert;
export type OrderEvents = typeof orderEvents.$inferSelect;
export type InsertOrderEvents = typeof orderEvents.$inferInsert;
export type WorkerJob = typeof workerJob.$inferSelect;
export type InsertWorkerJob = typeof workerJob.$inferInsert;
export type WorkerHeartbeat = typeof workerHeartbeat.$inferSelect;
export type InsertWorkerHeartbeat = typeof workerHeartbeat.$inferInsert;
export type OutboundMessageQueue = typeof outboundMessageQueue.$inferSelect;
export type InsertOutboundMessageQueue = typeof outboundMessageQueue.$inferInsert;
export type GeocodeCache = typeof geocodeCache.$inferSelect;
export type InsertGeocodeCache = typeof geocodeCache.$inferInsert;
export type AiResponseCache = typeof aiResponseCache.$inferSelect;
export type InsertAiResponseCache = typeof aiResponseCache.$inferInsert;
export type AiLearningReview = typeof aiLearningReview.$inferSelect;
export type InsertAiLearningReview = typeof aiLearningReview.$inferInsert;
export type DeliveryAssignment = typeof deliveryAssignment.$inferSelect;
export type InsertDeliveryAssignment = typeof deliveryAssignment.$inferInsert;
export type DeliveryRoutePoint = typeof deliveryRoutePoint.$inferSelect;
export type InsertDeliveryRoutePoint = typeof deliveryRoutePoint.$inferInsert;
