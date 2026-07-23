# Schema Snapshot — Rumah Keripik
> Generated: 2026-07-23T13:04:22.361Z

**Total Tables: 68**

## Table List

- `__drizzle_migrations`
- `admin_audit_log`
- `ai_knowledge_base`
- `ai_learning_review`
- `ai_response_cache`
- `ai_runs`
- `ai_tool_calls`
- `backup_restore_drills`
- `bot_auto_reply`
- `bot_menu_item`
- `bot_setting`
- `broadcast_campaign`
- `broadcast_template`
- `bukti_pembayaran`
- `cash_reconciliation`
- `chat_cart_items`
- `chat_carts`
- `chat_log`
- `chat_messages`
- `chat_sessions`
- `courier_sessions`
- `couriers`
- `customer_address`
- `customer_identity`
- `customer_memory_v3`
- `customer_profile`
- `customer_sessions`
- `delivery_assignment`
- `delivery_route_point`
- `detail_transaksi`
- `expense_categories`
- `expo_push_tokens`
- `failed_conversation`
- `geocode_cache`
- `idempotency_keys`
- `ledger_entries`
- `lokasi_pelanggan`
- `loyalty_accounts`
- `loyalty_ledger`
- `memory_pelanggan`
- `order_document`
- `order_draft`
- `order_events`
- `order_status_history`
- `outbound_message_queue`
- `payment_intent`
- `payment_method`
- `payment_ocr_result`
- `payment_proof`
- `pelanggan_chatbot`
- `pesan_chat`
- `produk`
- `produk_kategori`
- `produk_media`
- `produk_varian`
- `rate_limits`
- `rating_pelanggan`
- `referrals`
- `skill_library`
- `sqlite_sequence`
- `transaksi`
- `waitlist_produk`
- `warung_retail`
- `web_chat_message`
- `web_order_session`
- `worker_heartbeat`
- `worker_job`
- `zona_pengiriman`

## Schema Detail

### __drizzle_migrations
```sql
CREATE TABLE "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)
```

Rows: 0

### admin_audit_log
```sql
CREATE TABLE admin_audit_log (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, ip_hash TEXT, user_agent_hash TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 9

### ai_knowledge_base
```sql
CREATE TABLE ai_knowledge_base (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, judul text NOT NULL, potongan_teks text NOT NULL, kategori text, vector_embedding blob, tanggal_upload text DEFAULT (datetime('now', 'utc')) NOT NULL, is_active integer DEFAULT 1 NOT NULL)
```

Rows: 20

### ai_learning_review
```sql
CREATE TABLE ai_learning_review (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_pattern TEXT NOT NULL,
      suggested_response TEXT NOT NULL,
      source_chat_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### ai_response_cache
```sql
CREATE TABLE ai_response_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT NOT NULL UNIQUE,
      prompt_hash TEXT NOT NULL,
      response_text TEXT NOT NULL,
      model_used TEXT,
      tokens_used INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### ai_runs
```sql
CREATE TABLE ai_runs (id TEXT PRIMARY KEY, chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL, message_id TEXT, task TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER, status TEXT NOT NULL, error_message TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 51

### ai_tool_calls
```sql
CREATE TABLE ai_tool_calls (id TEXT PRIMARY KEY, ai_run_id TEXT REFERENCES ai_runs(id) ON DELETE CASCADE, chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL, tool_name TEXT NOT NULL, input_json TEXT, output_json TEXT, status TEXT NOT NULL DEFAULT 'success', latency_ms INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 0

### backup_restore_drills
```sql
CREATE TABLE backup_restore_drills (
      id TEXT PRIMARY KEY,
      drill_date TEXT NOT NULL,
      backup_snapshot_id TEXT NOT NULL,
      restore_target_env TEXT NOT NULL DEFAULT 'staging',
      success INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER,
      issues_found TEXT,
      performed_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### bot_auto_reply
```sql
CREATE TABLE bot_auto_reply (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      keyword TEXT NOT NULL,
      response TEXT NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'utc')) NOT NULL
    )
```

Rows: 8

### bot_menu_item
```sql
CREATE TABLE bot_menu_item (id INTEGER PRIMARY KEY AUTOINCREMENT, surface TEXT NOT NULL DEFAULT 'public_ordering', label TEXT NOT NULL, action TEXT NOT NULL, value TEXT, payload_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 4

### bot_setting
```sql
CREATE TABLE bot_setting (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_by TEXT)
```

Rows: 2

### broadcast_campaign
```sql
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
)
```

Rows: 0

### broadcast_template
```sql
CREATE TABLE `broadcast_template` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`konten` text NOT NULL,
	`kategori` text DEFAULT 'Lainnya' NOT NULL,
	`created_at` text DEFAULT (datetime('now', 'utc')) NOT NULL
)
```

Rows: 0

### bukti_pembayaran
```sql
CREATE TABLE bukti_pembayaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      no_wa_pelanggan TEXT NOT NULL,
      url_gambar TEXT NOT NULL,
      base64_data TEXT,
      mimetype TEXT DEFAULT 'image/jpeg',
      caption TEXT,
      status_verifikasi TEXT NOT NULL DEFAULT 'Menunggu' CHECK (status_verifikasi IN ('Menunggu', 'Diterima', 'Ditolak')),
      diverifikasi_oleh TEXT,
      catatan_admin TEXT,
      waktu_upload TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      waktu_verifikasi TEXT
    )
```

Rows: 0

### cash_reconciliation
```sql
CREATE TABLE cash_reconciliation (
      id TEXT PRIMARY KEY,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      system_balance INTEGER NOT NULL,
      actual_balance INTEGER,
      discrepancy_note TEXT,
      reconciled_by TEXT,
      reconciled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### chat_cart_items
```sql
CREATE TABLE chat_cart_items (id TEXT PRIMARY KEY, cart_id TEXT NOT NULL REFERENCES chat_carts(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE RESTRICT, variant_id TEXT REFERENCES produk_varian(id_varian), quantity INTEGER NOT NULL, price_snapshot INTEGER NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 30

### chat_carts
```sql
CREATE TABLE chat_carts (id TEXT PRIMARY KEY, chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, customer_id TEXT REFERENCES customer_profile(id_customer), status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 104

### chat_log
```sql
CREATE TABLE chat_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      no_wa_pelanggan TEXT NOT NULL,
      user_message TEXT NOT NULL,
      bot_response TEXT,
      sumber TEXT DEFAULT 'rule' NOT NULL,
      model_used TEXT,
      tokens_used INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now', 'utc')) NOT NULL
    , `channel` text DEFAULT 'wa' NOT NULL)
```

Rows: 5

### chat_messages
```sql
CREATE TABLE chat_messages (id TEXT PRIMARY KEY, chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', component_json TEXT, metadata_json TEXT, token_estimate INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 221

### chat_sessions
```sql
CREATE TABLE chat_sessions (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customer_profile(id_customer), customer_session_id TEXT NOT NULL REFERENCES customer_sessions(id) ON DELETE CASCADE, title TEXT, status TEXT NOT NULL DEFAULT 'active', ai_mode TEXT NOT NULL DEFAULT 'enabled', assigned_admin_id TEXT, active_order_id TEXT REFERENCES transaksi(id_transaksi), created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 91

### courier_sessions
```sql
CREATE TABLE courier_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  last_active_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
, device_id TEXT, is_active INTEGER NOT NULL DEFAULT 1)
```

Rows: 0

### couriers
```sql
CREATE TABLE couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  vehicle TEXT CHECK(vehicle IN ('motor', 'mobil')),
  plat_no TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_lat TEXT,
  last_lng TEXT,
  last_location_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
, device_id TEXT)
```

Rows: 1

### customer_address
```sql
CREATE TABLE customer_address (id_address INTEGER PRIMARY KEY AUTOINCREMENT, id_customer TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE, label TEXT, recipient_name TEXT, phone TEXT, address_text TEXT NOT NULL, province TEXT, city TEXT, district TEXT, postal_code TEXT, latitude TEXT, longitude TEXT, location_accuracy INTEGER, location_source TEXT, landmark TEXT, courier_note TEXT, is_default INTEGER NOT NULL DEFAULT 0, last_used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 74

### customer_identity
```sql
CREATE TABLE customer_identity (id INTEGER PRIMARY KEY AUTOINCREMENT, id_customer TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE, provider TEXT NOT NULL, external_id TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 73

### customer_memory_v3
```sql
CREATE TABLE customer_memory_v3 (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL, confidence INTEGER NOT NULL DEFAULT 70, source TEXT NOT NULL DEFAULT 'system', visibility TEXT NOT NULL DEFAULT 'both', reviewed_by_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 70

### customer_profile
```sql
CREATE TABLE customer_profile (id_customer TEXT PRIMARY KEY, nama TEXT, phone TEXT, email TEXT, default_address_id INTEGER, notes TEXT, tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), last_active_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), pin TEXT)
```

Rows: 73

### customer_sessions
```sql
CREATE TABLE customer_sessions (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customer_profile(id_customer), session_token_hash TEXT NOT NULL UNIQUE, anonymous_label TEXT, user_agent_hash TEXT, ip_hash TEXT, last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 73

### delivery_assignment
```sql
CREATE TABLE delivery_assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      kurir_name TEXT,
      status TEXT NOT NULL DEFAULT 'Siap_Dikirim' CHECK (status IN ('Siap_Dikirim','Dalam_Pengiriman','Terkirim','Gagal')),
      pickup_at TEXT,
      delivered_at TEXT,
      proof_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    , kurir_id INTEGER REFERENCES couriers(id), signature_url text)
```

Rows: 0

### delivery_route_point
```sql
CREATE TABLE delivery_route_point (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_date TEXT NOT NULL,
      id_transaksi TEXT NOT NULL,
      sequence_no INTEGER NOT NULL,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','visited','skipped'))
    )
```

Rows: 0

### detail_transaksi
```sql
CREATE TABLE `detail_transaksi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_transaksi` text NOT NULL,
	`id_produk` text NOT NULL,
	`qty_terjual` integer NOT NULL,
	`harga_snapshot` integer NOT NULL,
	`subtotal` integer NOT NULL, id_varian TEXT, nama_produk_snapshot TEXT, nama_varian_snapshot TEXT, berat_gram_snapshot INTEGER,
	FOREIGN KEY (`id_transaksi`) REFERENCES `transaksi`(`id_transaksi`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`id_produk`) REFERENCES `produk`(`id_produk`) ON UPDATE no action ON DELETE no action
)
```

Rows: 74

### expense_categories
```sql
CREATE TABLE expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cogs','operational','marketing','other')),
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### expo_push_tokens
```sql
CREATE TABLE expo_push_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customer_profile(id_customer),
  order_session_id TEXT,
  platform TEXT NOT NULL DEFAULT 'android' CHECK(platform IN ('android', 'ios')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
, courier_id INTEGER REFERENCES couriers(id))
```

Rows: 0

### failed_conversation
```sql
CREATE TABLE failed_conversation (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, id_session TEXT, no_wa_pelanggan TEXT, user_message TEXT NOT NULL, current_state TEXT, reason TEXT NOT NULL, raw_ai_output TEXT, model_used TEXT, resolved INTEGER NOT NULL DEFAULT 0, admin_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), reviewed_at TEXT)
```

Rows: 51

### geocode_cache
```sql
CREATE TABLE geocode_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL UNIQUE,
      lat TEXT,
      lng TEXT,
      formatted_address TEXT,
      provider TEXT NOT NULL DEFAULT 'nominatim',
      confidence INTEGER,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### idempotency_keys
```sql
CREATE TABLE idempotency_keys (
      key TEXT PRIMARY KEY,
      response_json TEXT NOT NULL,
      status INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### ledger_entries
```sql
CREATE TABLE ledger_entries (
      id TEXT PRIMARY KEY,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('revenue','expense','refund','adjustment')),
      amount INTEGER NOT NULL,
      category_id TEXT REFERENCES expense_categories(id),
      related_order_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      created_by TEXT
    )
```

Rows: 0

### lokasi_pelanggan
```sql
CREATE TABLE lokasi_pelanggan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL REFERENCES pelanggan_chatbot(no_wa_pelanggan) ON DELETE CASCADE,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      alamat_teks TEXT,
      source TEXT NOT NULL CHECK (source IN ('wa_native', 'wa_live', 'maps_link', 'maps_short', 'geocoded', 'manual')),
      accuracy_meter INTEGER,
      is_verified INTEGER NOT NULL DEFAULT 0,
      id_transaksi TEXT,
      catatan TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 3

### loyalty_accounts
```sql
CREATE TABLE loyalty_accounts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE,
      points_balance INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'bronze' CHECK(tier IN ('bronze','silver','gold')),
      referral_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### loyalty_ledger
```sql
CREATE TABLE loyalty_ledger (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('order_completed','referral_bonus','redeemed','admin_adjustment')),
      related_order_id TEXT,
      balance_after INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### memory_pelanggan
```sql
CREATE TABLE memory_pelanggan (
      no_wa_pelanggan TEXT PRIMARY KEY REFERENCES pelanggan_chatbot(no_wa_pelanggan) ON DELETE CASCADE,
      produk_favorit TEXT DEFAULT '[]',
      alamat_tersimpan TEXT DEFAULT '[]',
      avg_order_value INTEGER DEFAULT 0,
      total_order INTEGER DEFAULT 0,
      avg_rating INTEGER DEFAULT 0,
      tags_preferensi TEXT DEFAULT '[]',
      last_order_id TEXT,
      last_order_date TEXT,
      waitlist_produk TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### order_document
```sql
CREATE TABLE order_document (
      id_document TEXT PRIMARY KEY,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      document_type TEXT NOT NULL CHECK (document_type IN ('proforma','receipt','packing-label')),
      document_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','void')),
      issued_by TEXT NOT NULL DEFAULT 'system',
      issued_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      print_count INTEGER NOT NULL DEFAULT 0,
      last_printed_at TEXT,
      metadata_json TEXT
    )
```

Rows: 9

### order_draft
```sql
CREATE TABLE order_draft (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL REFERENCES pelanggan_chatbot(no_wa_pelanggan),
      channel TEXT NOT NULL DEFAULT 'wa' CHECK (channel IN ('wa', 'telegram')),
      status TEXT NOT NULL DEFAULT 'Profil_Pending' CHECK (status IN ('Profil_Pending','Cart_Pending','Menunggu_Bayar','Menunggu_Verifikasi','Completed','Cancelled')),
      id_transaksi TEXT,
      context_json TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### order_events
```sql
CREATE TABLE order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi TEXT,
      no_wa_pelanggan TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 1076

### order_status_history
```sql
CREATE TABLE order_status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE, order_status TEXT, payment_status TEXT, event_type TEXT NOT NULL, note TEXT, actor TEXT NOT NULL DEFAULT 'system', metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 192

### outbound_message_queue
```sql
CREATE TABLE outbound_message_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL CHECK (channel IN ('wa', 'telegram')),
      recipient_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      provider_message_id TEXT,
      error_message TEXT,
      scheduled_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### payment_intent
```sql
CREATE TABLE payment_intent (id_payment_intent TEXT PRIMARY KEY, id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE, id_payment_method TEXT REFERENCES payment_method(id_payment_method), method_type TEXT NOT NULL, amount_due INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'instruction_shown', instruction_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 74

### payment_method
```sql
CREATE TABLE payment_method (id_payment_method TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, account_name TEXT, account_number TEXT, bank_name TEXT, qris_public_id TEXT, qris_image_url TEXT, note TEXT, min_order_total INTEGER, max_order_total INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 5

### payment_ocr_result
```sql
CREATE TABLE payment_ocr_result (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_payment_proof TEXT NOT NULL REFERENCES payment_proof(id_payment_proof) ON DELETE CASCADE,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      worker_job_id INTEGER,
      engine TEXT NOT NULL DEFAULT 'rule_based_mvp',
      extracted_text TEXT,
      extracted_amount INTEGER,
      reference_number TEXT,
      status_keywords_json TEXT NOT NULL DEFAULT '[]',
      score INTEGER NOT NULL DEFAULT 0,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      summary TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 5

### payment_proof
```sql
CREATE TABLE payment_proof (id_payment_proof TEXT PRIMARY KEY, id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE, cloudinary_public_id TEXT NOT NULL, secure_url TEXT NOT NULL, original_filename TEXT, file_format TEXT, file_size_bytes INTEGER, amount_claimed INTEGER, status TEXT NOT NULL DEFAULT 'pending', uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), verified_by TEXT, verified_at TEXT, admin_note TEXT)
```

Rows: 34

### pelanggan_chatbot
```sql
CREATE TABLE pelanggan_chatbot (no_wa_pelanggan text PRIMARY KEY NOT NULL, nama_pelanggan text, alamat_pengiriman text, status_handle text DEFAULT 'AI_Bot' NOT NULL, context_sesi text, waktu_daftar text DEFAULT (datetime('now', 'utc')) NOT NULL, terakhir_aktif text DEFAULT (datetime('now', 'utc')) NOT NULL, tags text DEFAULT '[]', diambil_oleh text, `channel` text DEFAULT 'wa' NOT NULL)
```

Rows: 26

### pesan_chat
```sql
CREATE TABLE pesan_chat (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, no_wa_pelanggan text NOT NULL, direction text NOT NULL, sumber text NOT NULL, teks text NOT NULL, id_external text, status_kirim text DEFAULT 'sent' NOT NULL, timestamp text DEFAULT (datetime('now', 'utc')) NOT NULL, `channel` text DEFAULT 'wa' NOT NULL, FOREIGN KEY (no_wa_pelanggan) REFERENCES pelanggan_chatbot(no_wa_pelanggan))
```

Rows: 10

### produk
```sql
CREATE TABLE produk (id_produk text PRIMARY KEY NOT NULL, nama_produk text NOT NULL, deskripsi text, harga_jual integer NOT NULL, stok_gudang_utama integer DEFAULT 0 NOT NULL, is_active integer DEFAULT 1 NOT NULL, updated_at text DEFAULT (datetime('now', 'utc')) NOT NULL, slug TEXT, kategori_id TEXT, berat_gram INTEGER, cloudinary_public_id TEXT, image_url TEXT, image_alt TEXT, tags_json TEXT NOT NULL DEFAULT '[]', is_featured INTEGER NOT NULL DEFAULT 0, is_best_seller INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00')
```

Rows: 5

### produk_kategori
```sql
CREATE TABLE produk_kategori (id_kategori TEXT PRIMARY KEY, nama_kategori TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, deskripsi TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 1

### produk_media
```sql
CREATE TABLE produk_media (id_media INTEGER PRIMARY KEY AUTOINCREMENT, id_produk TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE CASCADE, id_varian TEXT REFERENCES produk_varian(id_varian) ON DELETE CASCADE, cloudinary_public_id TEXT NOT NULL, secure_url TEXT, media_type TEXT NOT NULL DEFAULT 'image', alt_text TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 0

### produk_varian
```sql
CREATE TABLE produk_varian (id_varian TEXT PRIMARY KEY, id_produk TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE CASCADE, sku TEXT UNIQUE, nama_varian TEXT NOT NULL, rasa TEXT, ukuran TEXT, berat_gram INTEGER, harga_jual INTEGER NOT NULL, stok INTEGER NOT NULL DEFAULT 0, cloudinary_public_id TEXT, image_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 2

### rate_limits
```sql
CREATE TABLE rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      reset_at INTEGER NOT NULL
    )
```

Rows: 1

### rating_pelanggan
```sql
CREATE TABLE rating_pelanggan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL,
      id_transaksi TEXT,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      feedback_text TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### referrals
```sql
CREATE TABLE referrals (
      id TEXT PRIMARY KEY,
      referrer_account_id TEXT NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      referee_customer_id TEXT REFERENCES customer_profile(id_customer),
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','used','expired')),
      bonus_points_awarded INTEGER,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### skill_library
```sql
CREATE TABLE skill_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL,
      trigger_pattern TEXT NOT NULL,
      response_template TEXT NOT NULL,
      success_count INTEGER NOT NULL DEFAULT 1,
      avg_rating INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### sqlite_sequence
```sql
CREATE TABLE sqlite_sequence(name,seq)
```

Rows: 16

### transaksi
```sql
CREATE TABLE transaksi (id_transaksi text PRIMARY KEY NOT NULL, no_wa_pelanggan text, id_warung text, tipe_penjualan text DEFAULT 'Online_WA' NOT NULL, total_bayar integer NOT NULL, status_pembayaran text DEFAULT 'Lunas' NOT NULL, tanggal_jatuh_tempo text, kode_pesanan text, catatan text, waktu_simpan text DEFAULT (datetime('now', 'utc')) NOT NULL, nama_penerima TEXT, alamat_penerima TEXT, no_hp_penerima TEXT, bukti_transfer_url TEXT, sumber_order TEXT DEFAULT 'Offline', lat_pengiriman TEXT, lng_pengiriman TEXT, jarak_km_dari_gudang TEXT, invoice_url TEXT, id_customer TEXT, id_session TEXT, id_address INTEGER, order_status TEXT NOT NULL DEFAULT 'draft', payment_status TEXT NOT NULL DEFAULT 'unpaid', payment_method TEXT, shipping_address_snapshot TEXT, shipping_location_json TEXT, admin_note TEXT, verified_by TEXT, verified_at TEXT, status_token TEXT, updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00', FOREIGN KEY (no_wa_pelanggan) REFERENCES pelanggan_chatbot(no_wa_pelanggan), FOREIGN KEY (id_warung) REFERENCES warung_retail(id_warung))
```

Rows: 74

### waitlist_produk
```sql
CREATE TABLE waitlist_produk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL REFERENCES pelanggan_chatbot(no_wa_pelanggan) ON DELETE CASCADE,
      id_produk TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'wa' CHECK (channel IN ('wa', 'telegram')),
      sudah_dinotif INTEGER NOT NULL DEFAULT 0,
      waktu_daftar TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 0

### warung_retail
```sql
CREATE TABLE warung_retail (id_warung text PRIMARY KEY NOT NULL, nama_warung text NOT NULL, pemilik text, no_wa_warung text, alamat text NOT NULL, tipe_kemitraan text DEFAULT 'Reseller' NOT NULL, min_order_grosir integer DEFAULT 0 NOT NULL, is_active integer DEFAULT 1 NOT NULL, waktu_daftar text DEFAULT (datetime('now', 'utc')) NOT NULL, updated_at text DEFAULT (datetime('now', 'utc')) NOT NULL)
```

Rows: 2

### web_chat_message
```sql
CREATE TABLE web_chat_message (id INTEGER PRIMARY KEY AUTOINCREMENT, id_session TEXT NOT NULL REFERENCES web_order_session(id_session) ON DELETE CASCADE, direction TEXT NOT NULL, message_type TEXT NOT NULL, text TEXT, payload_json TEXT, action_json TEXT, model_used TEXT, tokens_used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 1016

### web_order_session
```sql
CREATE TABLE web_order_session (id_session TEXT PRIMARY KEY, anonymous_token TEXT NOT NULL UNIQUE, id_customer TEXT REFERENCES customer_profile(id_customer), current_state TEXT NOT NULL DEFAULT 'START', cart_json TEXT NOT NULL DEFAULT '{}', context_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active', last_event_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))
```

Rows: 1082

### worker_heartbeat
```sql
CREATE TABLE worker_heartbeat (
      worker_id TEXT PRIMARY KEY,
      worker_name TEXT,
      status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','idle','offline')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      meta_json TEXT
    )
```

Rows: 42

### worker_job
```sql
CREATE TABLE worker_job (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
      priority INTEGER NOT NULL DEFAULT 5,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      locked_by TEXT,
      locked_until TEXT,
      result_json TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
```

Rows: 9

### zona_pengiriman
```sql
CREATE TABLE zona_pengiriman (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_zona TEXT NOT NULL,
      lat_pusat TEXT NOT NULL,
      lng_pusat TEXT NOT NULL,
      radius_km INTEGER NOT NULL DEFAULT 5,
      ongkir_min INTEGER NOT NULL DEFAULT 0,
      ongkir_max INTEGER NOT NULL DEFAULT 0,
      total_order_bulan_ini INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )
```

Rows: 0
