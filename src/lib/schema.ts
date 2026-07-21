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

// ─── KATALOG PRODUK WEB ───────────────────────────────────────────────────────
export const produkKategori = sqliteTable(
  'produk_kategori',
  {
    id_kategori: text('id_kategori').primaryKey(),
    nama_kategori: text('nama_kategori').notNull(),
    slug: text('slug').notNull().unique(),
    deskripsi: text('deskripsi'),
    sort_order: integer('sort_order').notNull().default(0),
    is_active: integer('is_active').notNull().default(1),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    activeSortIdx: index('idx_produk_kategori_active_sort').on(table.is_active, table.sort_order),
    slugIdx: index('idx_produk_kategori_slug').on(table.slug),
  })
);

// ─── PRODUK ──────────────────────────────────────────────────────────────────
export const produk = sqliteTable(
  'produk',
  {
    id_produk: text('id_produk').primaryKey(), // KRP-001
    nama_produk: text('nama_produk').notNull(),
    deskripsi: text('deskripsi'),
    harga_jual: integer('harga_jual').notNull(), // Rupiah
    stok_gudang_utama: integer('stok_gudang_utama').notNull().default(0),
    is_active: integer('is_active').notNull().default(1), // 0 or 1
    slug: text('slug').unique(),
    kategori_id: text('kategori_id').references(() => produkKategori.id_kategori),
    berat_gram: integer('berat_gram'),
    cloudinary_public_id: text('cloudinary_public_id'),
    image_url: text('image_url'),
    image_alt: text('image_alt'),
    tags_json: text('tags_json').notNull().default('[]'),
    is_featured: integer('is_featured').notNull().default(0),
    is_best_seller: integer('is_best_seller').notNull().default(0),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at')
      .notNull()
      .default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    activeKategoriIdx: index('idx_produk_active_kategori').on(table.is_active, table.kategori_id),
    slugIdx: index('idx_produk_slug').on(table.slug),
    featuredIdx: index('idx_produk_featured').on(table.is_active, table.is_featured, table.sort_order),
    bestSellerIdx: index('idx_produk_best_seller').on(table.is_active, table.is_best_seller, table.sort_order),
  })
);

export const produkVarian = sqliteTable(
  'produk_varian',
  {
    id_varian: text('id_varian').primaryKey(),
    id_produk: text('id_produk')
      .notNull()
      .references(() => produk.id_produk, { onDelete: 'cascade' }),
    sku: text('sku').unique(),
    nama_varian: text('nama_varian').notNull(),
    rasa: text('rasa'),
    ukuran: text('ukuran'),
    berat_gram: integer('berat_gram'),
    harga_jual: integer('harga_jual').notNull(),
    stok: integer('stok').notNull().default(0),
    cloudinary_public_id: text('cloudinary_public_id'),
    image_url: text('image_url'),
    is_active: integer('is_active').notNull().default(1),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    produkActiveIdx: index('idx_varian_produk_active').on(table.id_produk, table.is_active),
    skuIdx: index('idx_varian_sku').on(table.sku),
    stockIdx: index('idx_varian_stock').on(table.is_active, table.stok),
  })
);

export const produkMedia = sqliteTable(
  'produk_media',
  {
    id_media: integer('id_media').primaryKey({ autoIncrement: true }),
    id_produk: text('id_produk')
      .notNull()
      .references(() => produk.id_produk, { onDelete: 'cascade' }),
    id_varian: text('id_varian').references(() => produkVarian.id_varian, { onDelete: 'cascade' }),
    cloudinary_public_id: text('cloudinary_public_id').notNull(),
    secure_url: text('secure_url'),
    media_type: text('media_type', { enum: ['image', 'video'] }).notNull().default('image'),
    alt_text: text('alt_text'),
    sort_order: integer('sort_order').notNull().default(0),
    is_primary: integer('is_primary').notNull().default(0),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    produkIdx: index('idx_produk_media_produk').on(table.id_produk, table.sort_order),
    varianIdx: index('idx_produk_media_varian').on(table.id_varian),
    primaryIdx: index('idx_produk_media_primary').on(table.id_produk, table.is_primary),
  })
);

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

// ─── CUSTOMER WEB / CHANNEL-NEUTRAL ───────────────────────────────────────────
export const customerProfile = sqliteTable(
  'customer_profile',
  {
    id_customer: text('id_customer').primaryKey(),
    nama: text('nama'),
    phone: text('phone'),
    email: text('email'),
    pin: text('pin'), // 4-digit security PIN for data recovery
    default_address_id: integer('default_address_id'),
    notes: text('notes'),
    tags_json: text('tags_json').notNull().default('[]'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    last_active_at: text('last_active_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    phoneIdx: index('idx_customer_phone').on(table.phone),
    lastActiveIdx: index('idx_customer_last_active').on(table.last_active_at),
  })
);

export const customerIdentity = sqliteTable(
  'customer_identity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_customer: text('id_customer')
      .notNull()
      .references(() => customerProfile.id_customer, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['wa', 'telegram', 'web'] }).notNull(),
    external_id: text('external_id').notNull(),
    verified_at: text('verified_at'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    providerExternalUnique: unique('uq_customer_identity_provider_external').on(table.provider, table.external_id),
    customerIdx: index('idx_customer_identity_customer').on(table.id_customer),
  })
);

export const customerAddress = sqliteTable(
  'customer_address',
  {
    id_address: integer('id_address').primaryKey({ autoIncrement: true }),
    id_customer: text('id_customer')
      .notNull()
      .references(() => customerProfile.id_customer, { onDelete: 'cascade' }),
    label: text('label'),
    recipient_name: text('recipient_name'),
    phone: text('phone'),
    address_text: text('address_text').notNull(),
    province: text('province'),
    city: text('city'),
    district: text('district'),
    postal_code: text('postal_code'),
    latitude: text('latitude'),
    longitude: text('longitude'),
    location_accuracy: integer('location_accuracy'),
    location_source: text('location_source', { enum: ['manual', 'gps', 'map_picker', 'saved_address'] }),
    landmark: text('landmark'),
    courier_note: text('courier_note'),
    is_default: integer('is_default').notNull().default(0),
    last_used_at: text('last_used_at'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    customerIdx: index('idx_customer_address_customer').on(table.id_customer, table.last_used_at),
    defaultIdx: index('idx_customer_address_default').on(table.id_customer, table.is_default),
  })
);

export const webOrderSession = sqliteTable(
  'web_order_session',
  {
    id_session: text('id_session').primaryKey(),
    anonymous_token: text('anonymous_token').notNull().unique(),
    id_customer: text('id_customer').references(() => customerProfile.id_customer),
    current_state: text('current_state').notNull().default('START'),
    cart_json: text('cart_json').notNull().default('{}'),
    context_json: text('context_json').notNull().default('{}'),
    status: text('status', { enum: ['active', 'completed', 'abandoned', 'expired'] }).notNull().default('active'),
    last_event_at: text('last_event_at').notNull().default(sql`(datetime('now', 'utc'))`),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    tokenIdx: index('idx_web_order_session_token').on(table.anonymous_token),
    customerIdx: index('idx_web_order_session_customer').on(table.id_customer),
    statusIdx: index('idx_web_order_session_status').on(table.status, table.last_event_at),
  })
);

export const webChatMessage = sqliteTable(
  'web_chat_message',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_session: text('id_session')
      .notNull()
      .references(() => webOrderSession.id_session, { onDelete: 'cascade' }),
    direction: text('direction', { enum: ['in', 'out'] }).notNull(),
    message_type: text('message_type', {
      enum: ['text', 'quick_replies', 'product_cards', 'form', 'payment_upload', 'confirmation', 'system'],
    }).notNull(),
    text: text('text'),
    payload_json: text('payload_json'),
    action_json: text('action_json'),
    model_used: text('model_used'),
    tokens_used: integer('tokens_used').notNull().default(0),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    sessionTimeIdx: index('idx_web_chat_message_session_time').on(table.id_session, table.created_at),
    typeIdx: index('idx_web_chat_message_type').on(table.message_type),
  })
);

// ─── TRANSAKSI ───────────────────────────────────────────────────────────────
export const transaksi = sqliteTable(
  'transaksi',
  {
    id_transaksi: text('id_transaksi').primaryKey(), // TX-20260622-001
    no_wa_pelanggan: text('no_wa_pelanggan').references(
      () => pelangganChatbot.no_wa_pelanggan
    ), // NULLABLE
    id_warung: text('id_warung').references(() => warungRetail.id_warung), // NULLABLE
    id_customer: text('id_customer').references(() => customerProfile.id_customer),
    id_session: text('id_session').references(() => webOrderSession.id_session),
    id_address: integer('id_address').references(() => customerAddress.id_address),
    tipe_penjualan: text('tipe_penjualan', {
      enum: ['Online_WA', 'Offline_Gudang', 'Online_Web'],
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
    status_token: text('status_token'),
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
    order_status: text('order_status').notNull().default('draft'),
    payment_status: text('payment_status').notNull().default('unpaid'),
    payment_method: text('payment_method'),
    shipping_address_snapshot: text('shipping_address_snapshot'),
    shipping_location_json: text('shipping_location_json'),
    admin_note: text('admin_note'),
    verified_by: text('verified_by'),
    verified_at: text('verified_at'),
    
    waktu_simpan: text('waktu_simpan')
      .notNull()
      .default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    statusIdx: index('idx_transaksi_status').on(table.status_pembayaran),
    orderStatusIdx: index('idx_transaksi_order_status').on(table.order_status),
    paymentStatusIdx: index('idx_transaksi_payment_status').on(table.payment_status),
    tanggalIdx: index('idx_transaksi_tanggal').on(table.waktu_simpan),
    warungIdx: index('idx_transaksi_warung').on(table.id_warung),
    validasiTransaksi: check(
      'ck_transaksi_valid',
      sql`(${table.no_wa_pelanggan} IS NOT NULL) OR (${table.id_warung} IS NOT NULL) OR (${table.id_customer} IS NOT NULL)`
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
  id_varian: text('id_varian').references(() => produkVarian.id_varian),
  qty_terjual: integer('qty_terjual').notNull(),
  harga_snapshot: integer('harga_snapshot').notNull(), // Snapshot harga saat transaksi
  nama_produk_snapshot: text('nama_produk_snapshot'),
  nama_varian_snapshot: text('nama_varian_snapshot'),
  berat_gram_snapshot: integer('berat_gram_snapshot'),
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

export const paymentProof = sqliteTable(
  'payment_proof',
  {
    id_payment_proof: text('id_payment_proof').primaryKey(),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    cloudinary_public_id: text('cloudinary_public_id').notNull(),
    secure_url: text('secure_url').notNull(),
    original_filename: text('original_filename'),
    file_format: text('file_format'),
    file_size_bytes: integer('file_size_bytes'),
    amount_claimed: integer('amount_claimed'),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
    uploaded_at: text('uploaded_at').notNull().default(sql`(datetime('now', 'utc'))`),
    verified_by: text('verified_by'),
    verified_at: text('verified_at'),
    admin_note: text('admin_note'),
  },
  (table) => ({
    transaksiIdx: index('idx_payment_proof_transaksi').on(table.id_transaksi),
    statusTimeIdx: index('idx_payment_proof_status_time').on(table.status, table.uploaded_at),
  })
);

export const paymentOcrResult = sqliteTable(
  'payment_ocr_result',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_payment_proof: text('id_payment_proof')
      .notNull()
      .references(() => paymentProof.id_payment_proof, { onDelete: 'cascade' }),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    worker_job_id: integer('worker_job_id'),
    engine: text('engine').notNull().default('rule_based_mvp'),
    extracted_text: text('extracted_text'),
    extracted_amount: integer('extracted_amount'),
    reference_number: text('reference_number'),
    status_keywords_json: text('status_keywords_json').notNull().default('[]'),
    score: integer('score').notNull().default(0),
    warnings_json: text('warnings_json').notNull().default('[]'),
    summary: text('summary'),
    raw_json: text('raw_json'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    proofIdx: index('idx_payment_ocr_result_proof').on(table.id_payment_proof),
    transaksiIdx: index('idx_payment_ocr_result_transaksi').on(table.id_transaksi),
    scoreIdx: index('idx_payment_ocr_result_score').on(table.score),
    refIdx: index('idx_payment_ocr_result_reference').on(table.reference_number),
  })
);

export const paymentMethod = sqliteTable(
  'payment_method',
  {
    id_payment_method: text('id_payment_method').primaryKey(),
    type: text('type', { enum: ['bank_transfer', 'qris', 'ewallet', 'cod'] }).notNull(),
    label: text('label').notNull(),
    account_name: text('account_name'),
    account_number: text('account_number'),
    bank_name: text('bank_name'),
    qris_public_id: text('qris_public_id'),
    qris_image_url: text('qris_image_url'),
    note: text('note'),
    min_order_total: integer('min_order_total'),
    max_order_total: integer('max_order_total'),
    sort_order: integer('sort_order').notNull().default(0),
    is_active: integer('is_active').notNull().default(1),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    activeIdx: index('idx_payment_method_active').on(table.is_active, table.sort_order),
    typeIdx: index('idx_payment_method_type').on(table.type),
  })
);

export const paymentIntent = sqliteTable(
  'payment_intent',
  {
    id_payment_intent: text('id_payment_intent').primaryKey(),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    id_payment_method: text('id_payment_method').references(() => paymentMethod.id_payment_method),
    method_type: text('method_type', { enum: ['bank_transfer', 'qris', 'ewallet', 'cod'] }).notNull(),
    amount_due: integer('amount_due').notNull(),
    status: text('status', {
      enum: ['instruction_shown', 'proof_uploaded', 'awaiting_admin_verification', 'verified', 'rejected', 'cancelled'],
    }).notNull().default('instruction_shown'),
    instruction_json: text('instruction_json'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    transaksiIdx: index('idx_payment_intent_transaksi').on(table.id_transaksi),
    statusIdx: index('idx_payment_intent_status').on(table.status),
  })
);

export const orderStatusHistory = sqliteTable(
  'order_status_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    order_status: text('order_status'),
    payment_status: text('payment_status'),
    event_type: text('event_type').notNull(),
    note: text('note'),
    actor: text('actor').notNull().default('system'),
    metadata_json: text('metadata_json'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    transaksiIdx: index('idx_order_status_history_transaksi').on(table.id_transaksi, table.created_at),
    eventIdx: index('idx_order_status_history_event').on(table.event_type),
  })
);

export const orderDocument = sqliteTable(
  'order_document',
  {
    id_document: text('id_document').primaryKey(),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    document_type: text('document_type', { enum: ['proforma', 'receipt', 'packing-label'] }).notNull(),
    document_number: text('document_number').notNull().unique(),
    status: text('status', { enum: ['draft', 'issued', 'void'] }).notNull().default('issued'),
    issued_by: text('issued_by').notNull().default('system'),
    issued_at: text('issued_at').notNull().default(sql`(datetime('now', 'utc'))`),
    print_count: integer('print_count').notNull().default(0),
    last_printed_at: text('last_printed_at'),
    metadata_json: text('metadata_json'),
  },
  (table) => ({
    txTypeIdx: index('idx_order_document_tx_type').on(table.id_transaksi, table.document_type),
    numberIdx: index('idx_order_document_number').on(table.document_number),
  })
);

export const failedConversation = sqliteTable(
  'failed_conversation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel: text('channel', { enum: ['wa', 'telegram', 'web'] }).notNull(),
    id_session: text('id_session'),
    no_wa_pelanggan: text('no_wa_pelanggan'),
    user_message: text('user_message').notNull(),
    current_state: text('current_state'),
    reason: text('reason', {
      enum: ['low_confidence', 'invalid_json', 'no_product_found', 'provider_error', 'ambiguous_address', 'payment_issue', 'unknown'],
    }).notNull(),
    raw_ai_output: text('raw_ai_output'),
    model_used: text('model_used'),
    resolved: integer('resolved').notNull().default(0),
    admin_note: text('admin_note'),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    reviewed_at: text('reviewed_at'),
  },
  (table) => ({
    createdIdx: index('idx_failed_conversation_created').on(table.created_at),
    reasonIdx: index('idx_failed_conversation_reason').on(table.reason),
    resolvedIdx: index('idx_failed_conversation_resolved').on(table.resolved),
  })
);

export const botSetting = sqliteTable('bot_setting', {
  key: text('key').primaryKey(),
  value_json: text('value_json').notNull(),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  updated_by: text('updated_by'),
});

export const botMenuItem = sqliteTable(
  'bot_menu_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    surface: text('surface', { enum: ['public_ordering', 'wa', 'telegram', 'dashboard'] })
      .notNull()
      .default('public_ordering'),
    label: text('label').notNull(),
    action: text('action').notNull(),
    value: text('value'),
    payload_json: text('payload_json'),
    sort_order: integer('sort_order').notNull().default(0),
    is_active: integer('is_active').notNull().default(1),
    created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    surfaceActiveIdx: index('idx_bot_menu_surface_active').on(table.surface, table.is_active, table.sort_order),
  })
);

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

export const couriers = sqliteTable('couriers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  pin_hash: text('pin_hash').notNull(),
  vehicle: text('vehicle', { enum: ['motor', 'mobil'] }),
  plat_no: text('plat_no'),
  is_active: integer('is_active').notNull().default(1),
  last_lat: text('last_lat'),
  last_lng: text('last_lng'),
  last_location_at: text('last_location_at'),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
});

export const courierSessions = sqliteTable('courier_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  courierId: integer('courier_id').notNull().references(() => couriers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  last_active_at: text('last_active_at').notNull().default(sql`(datetime('now', 'utc'))`),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
}, (table) => ({
  courierIdx: index('idx_courier_sessions_courier').on(table.courierId),
}));

export const deliveryAssignment = sqliteTable(
  'delivery_assignment',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    id_transaksi: text('id_transaksi')
      .notNull()
      .references(() => transaksi.id_transaksi, { onDelete: 'cascade' }),
    kurir_id: integer('kurir_id').references(() => couriers.id),
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
    kurirIdx: index('idx_delivery_assignment_kurir').on(table.kurir_id),
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

// ─── CHAT V3 — AI CONVERSATIONAL COMMERCE ───────────────────────────────────
export const customerSessions = sqliteTable(
  'customer_sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').references(() => customerProfile.id_customer),
    sessionTokenHash: text('session_token_hash').notNull().unique(),
    anonymousLabel: text('anonymous_label'),
    userAgentHash: text('user_agent_hash'),
    ipHash: text('ip_hash'),
    lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now', 'utc'))`),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    tokenIdx: index('idx_customer_sessions_token_hash').on(table.sessionTokenHash),
    customerIdx: index('idx_customer_sessions_customer').on(table.customerId),
    lastSeenIdx: index('idx_customer_sessions_last_seen').on(table.lastSeenAt),
  })
);

export const chatSessions = sqliteTable(
  'chat_sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').references(() => customerProfile.id_customer),
    customerSessionId: text('customer_session_id')
      .notNull()
      .references(() => customerSessions.id, { onDelete: 'cascade' }),
    title: text('title'),
    status: text('status', { enum: ['active', 'needs_admin', 'closed', 'archived'] }).notNull().default('active'),
    aiMode: text('ai_mode', { enum: ['enabled', 'manual', 'paused'] }).notNull().default('enabled'),
    assignedAdminId: text('assigned_admin_id'),
    activeOrderId: text('active_order_id').references(() => transaksi.id_transaksi),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    sessionIdx: index('idx_chat_sessions_customer_session').on(table.customerSessionId, table.updatedAt),
    customerIdx: index('idx_chat_sessions_customer').on(table.customerId),
    statusIdx: index('idx_chat_sessions_status').on(table.status, table.updatedAt),
    orderIdx: index('idx_chat_sessions_order').on(table.activeOrderId),
  })
);

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    chatSessionId: text('chat_session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'admin', 'system', 'tool'] }).notNull(),
    content: text('content').notNull().default(''),
    componentJson: text('component_json'),
    metadataJson: text('metadata_json'),
    tokenEstimate: integer('token_estimate'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    sessionTimeIdx: index('idx_chat_messages_session_time').on(table.chatSessionId, table.createdAt),
    roleIdx: index('idx_chat_messages_role').on(table.role),
  })
);

export const chatCarts = sqliteTable(
  'chat_carts',
  {
    id: text('id').primaryKey(),
    chatSessionId: text('chat_session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customerProfile.id_customer),
    status: text('status', { enum: ['active', 'converted', 'abandoned'] }).notNull().default('active'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    sessionStatusIdx: index('idx_chat_carts_session_status').on(table.chatSessionId, table.status),
    customerIdx: index('idx_chat_carts_customer').on(table.customerId),
  })
);

export const chatCartItems = sqliteTable(
  'chat_cart_items',
  {
    id: text('id').primaryKey(),
    cartId: text('cart_id')
      .notNull()
      .references(() => chatCarts.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => produk.id_produk, { onDelete: 'restrict' }),
    variantId: text('variant_id').references(() => produkVarian.id_varian),
    quantity: integer('quantity').notNull(),
    priceSnapshot: integer('price_snapshot').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    cartIdx: index('idx_chat_cart_items_cart').on(table.cartId),
    productUnique: unique('uq_chat_cart_items_cart_product_variant').on(table.cartId, table.productId, table.variantId),
  })
);

export const customerMemoryV3 = sqliteTable(
  'customer_memory_v3',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customerProfile.id_customer, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    confidence: integer('confidence').notNull().default(70),
    source: text('source', { enum: ['chat', 'order', 'admin', 'system'] }).notNull().default('system'),
    visibility: text('visibility', { enum: ['ai', 'admin', 'both'] }).notNull().default('both'),
    reviewedByAdmin: integer('reviewed_by_admin').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    customerKeyIdx: index('idx_customer_memory_v3_customer_key').on(table.customerId, table.key),
  })
);

export const aiRuns = sqliteTable(
  'ai_runs',
  {
    id: text('id').primaryKey(),
    chatSessionId: text('chat_session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
    messageId: text('message_id'),
    task: text('task').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    latencyMs: integer('latency_ms'),
    status: text('status', { enum: ['success', 'error', 'fallback'] }).notNull(),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    chatIdx: index('idx_ai_runs_chat').on(table.chatSessionId, table.createdAt),
    taskIdx: index('idx_ai_runs_task').on(table.task, table.createdAt),
  })
);

export const aiToolCalls = sqliteTable(
  'ai_tool_calls',
  {
    id: text('id').primaryKey(),
    aiRunId: text('ai_run_id').references(() => aiRuns.id, { onDelete: 'cascade' }),
    chatSessionId: text('chat_session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
    toolName: text('tool_name').notNull(),
    inputJson: text('input_json'),
    outputJson: text('output_json'),
    status: text('status', { enum: ['success', 'error'] }).notNull().default('success'),
    latencyMs: integer('latency_ms'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    runIdx: index('idx_ai_tool_calls_run').on(table.aiRunId),
    chatIdx: index('idx_ai_tool_calls_chat').on(table.chatSessionId, table.createdAt),
    toolIdx: index('idx_ai_tool_calls_tool').on(table.toolName),
  })
);

export const recommendationEvents = sqliteTable(
  'recommendation_events',
  {
    id: text('id').primaryKey(),
    chatSessionId: text('chat_session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
    customerId: text('customer_id').references(() => customerProfile.id_customer, { onDelete: 'set null' }),
    eventType: text('event_type', { enum: ['shown', 'clicked', 'added_to_cart', 'ordered'] }).notNull(),
    productIdsJson: text('product_ids_json').notNull().default('[]'),
    selectedProductId: text('selected_product_id').references(() => produk.id_produk, { onDelete: 'set null' }),
    reason: text('reason'),
    metadataJson: text('metadata_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    chatIdx: index('idx_recommendation_events_chat').on(table.chatSessionId, table.createdAt),
    customerIdx: index('idx_recommendation_events_customer').on(table.customerId, table.createdAt),
    typeIdx: index('idx_recommendation_events_type').on(table.eventType, table.createdAt),
  })
);

export const aiLearningEvents = sqliteTable(
  'ai_learning_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    chatSessionId: text('chat_session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
    customerIdHash: text('customer_id_hash'),
    intent: text('intent'),
    productIdsJson: text('product_ids_json').notNull().default('[]'),
    outcome: text('outcome'),
    rating: integer('rating'),
    metadataJson: text('metadata_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    eventIdx: index('idx_ai_learning_events_type').on(table.eventType, table.createdAt),
    chatIdx: index('idx_ai_learning_events_chat').on(table.chatSessionId, table.createdAt),
    intentIdx: index('idx_ai_learning_events_intent').on(table.intent, table.createdAt),
  })
);

export const adminAuditLog = sqliteTable(
  'admin_audit_log',
  {
    id: text('id').primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
    metadataJson: text('metadata_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    actorIdx: index('idx_admin_audit_actor').on(table.actor, table.createdAt),
    actionIdx: index('idx_admin_audit_action').on(table.action, table.createdAt),
    resourceIdx: index('idx_admin_audit_resource').on(table.resourceType, table.resourceId, table.createdAt),
  })
);

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type CustomerSession = typeof customerSessions.$inferSelect;
export type InsertCustomerSession = typeof customerSessions.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type ChatCart = typeof chatCarts.$inferSelect;
export type InsertChatCart = typeof chatCarts.$inferInsert;
export type ChatCartItem = typeof chatCartItems.$inferSelect;
export type InsertChatCartItem = typeof chatCartItems.$inferInsert;
export type CustomerMemoryV3 = typeof customerMemoryV3.$inferSelect;
export type InsertCustomerMemoryV3 = typeof customerMemoryV3.$inferInsert;
export type AiRun = typeof aiRuns.$inferSelect;
export type InsertAiRun = typeof aiRuns.$inferInsert;
export type AiToolCall = typeof aiToolCalls.$inferSelect;
export type InsertAiToolCall = typeof aiToolCalls.$inferInsert;
export type RecommendationEvent = typeof recommendationEvents.$inferSelect;
export type InsertRecommendationEvent = typeof recommendationEvents.$inferInsert;
export type AiLearningEvent = typeof aiLearningEvents.$inferSelect;
export type InsertAiLearningEvent = typeof aiLearningEvents.$inferInsert;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

export type PelangganChatbot = typeof pelangganChatbot.$inferSelect;
export type InsertPelangganChatbot = typeof pelangganChatbot.$inferInsert;

export type ProdukKategori = typeof produkKategori.$inferSelect;
export type InsertProdukKategori = typeof produkKategori.$inferInsert;

export type Produk = typeof produk.$inferSelect;
export type InsertProduk = typeof produk.$inferInsert;

export type ProdukVarian = typeof produkVarian.$inferSelect;
export type InsertProdukVarian = typeof produkVarian.$inferInsert;

export type ProdukMedia = typeof produkMedia.$inferSelect;
export type InsertProdukMedia = typeof produkMedia.$inferInsert;

export type WarungRetail = typeof warungRetail.$inferSelect;
export type InsertWarungRetail = typeof warungRetail.$inferInsert;

export type CustomerProfile = typeof customerProfile.$inferSelect;
export type InsertCustomerProfile = typeof customerProfile.$inferInsert;

export type CustomerIdentity = typeof customerIdentity.$inferSelect;
export type InsertCustomerIdentity = typeof customerIdentity.$inferInsert;

export type CustomerAddress = typeof customerAddress.$inferSelect;
export type InsertCustomerAddress = typeof customerAddress.$inferInsert;

export type WebOrderSession = typeof webOrderSession.$inferSelect;
export type InsertWebOrderSession = typeof webOrderSession.$inferInsert;

export type WebChatMessage = typeof webChatMessage.$inferSelect;
export type InsertWebChatMessage = typeof webChatMessage.$inferInsert;

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

export type PaymentProof = typeof paymentProof.$inferSelect;
export type InsertPaymentProof = typeof paymentProof.$inferInsert;
export type PaymentOcrResult = typeof paymentOcrResult.$inferSelect;
export type InsertPaymentOcrResult = typeof paymentOcrResult.$inferInsert;

export type PaymentMethod = typeof paymentMethod.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethod.$inferInsert;

export type PaymentIntent = typeof paymentIntent.$inferSelect;
export type InsertPaymentIntent = typeof paymentIntent.$inferInsert;

export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistory = typeof orderStatusHistory.$inferInsert;
export type OrderDocument = typeof orderDocument.$inferSelect;
export type InsertOrderDocument = typeof orderDocument.$inferInsert;

export type FailedConversation = typeof failedConversation.$inferSelect;
export type InsertFailedConversation = typeof failedConversation.$inferInsert;

export type BotSetting = typeof botSetting.$inferSelect;
export type InsertBotSetting = typeof botSetting.$inferInsert;

export type BotMenuItem = typeof botMenuItem.$inferSelect;
export type InsertBotMenuItem = typeof botMenuItem.$inferInsert;

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
export type Courier = typeof couriers.$inferSelect;
export type InsertCourier = typeof couriers.$inferInsert;
export type CourierSession = typeof courierSessions.$inferSelect;
export type InsertCourierSession = typeof courierSessions.$inferInsert;
export type DeliveryAssignment = typeof deliveryAssignment.$inferSelect;
export type InsertDeliveryAssignment = typeof deliveryAssignment.$inferInsert;
export type DeliveryRoutePoint = typeof deliveryRoutePoint.$inferSelect;
export type InsertDeliveryRoutePoint = typeof deliveryRoutePoint.$inferInsert;

// ─── EXPO PUSH TOKENS ──────────────────────────────────────────────────────────
export const expoPushTokens = sqliteTable(
  'expo_push_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    token: text('token').notNull().unique(),
    customerId: text('customer_id').references(() => customerProfile.id_customer),
    orderSessionId: text('order_session_id'),
    courierId: integer('courier_id').references(() => couriers.id),
    platform: text('platform', { enum: ['android', 'ios'] }).notNull().default('android'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now', 'utc'))`),
    lastActiveAt: text('last_active_at').notNull().default(sql`(datetime('now', 'utc'))`),
  },
  (table) => ({
    customerIdx: index('idx_expo_push_customer').on(table.customerId),
    tokenIdx: unique('idx_expo_push_token').on(table.token),
    courierIdx: index('idx_expo_push_courier').on(table.courierId),
  })
);

export type ExpoPushToken = typeof expoPushTokens.$inferSelect;
export type InsertExpoPushToken = typeof expoPushTokens.$inferInsert;

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at').notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = typeof rateLimits.$inferInsert;

