import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index > 0) process.env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

async function addColumnIfMissing(client: ReturnType<typeof createClient>, table: string, column: string, ddl: string) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  if (info.rows.some((row) => row.name === column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  const createStatements = [
    `CREATE TABLE IF NOT EXISTS produk_kategori (id_kategori TEXT PRIMARY KEY, nama_kategori TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, deskripsi TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS produk_varian (id_varian TEXT PRIMARY KEY, id_produk TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE CASCADE, sku TEXT UNIQUE, nama_varian TEXT NOT NULL, rasa TEXT, ukuran TEXT, berat_gram INTEGER, harga_jual INTEGER NOT NULL, stok INTEGER NOT NULL DEFAULT 0, cloudinary_public_id TEXT, image_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS produk_media (id_media INTEGER PRIMARY KEY AUTOINCREMENT, id_produk TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE CASCADE, id_varian TEXT REFERENCES produk_varian(id_varian) ON DELETE CASCADE, cloudinary_public_id TEXT NOT NULL, secure_url TEXT, media_type TEXT NOT NULL DEFAULT 'image', alt_text TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS customer_profile (id_customer TEXT PRIMARY KEY, nama TEXT, phone TEXT, email TEXT, default_address_id INTEGER, notes TEXT, tags_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), last_active_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS customer_identity (id INTEGER PRIMARY KEY AUTOINCREMENT, id_customer TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE, provider TEXT NOT NULL, external_id TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_identity_provider_external ON customer_identity(provider, external_id)`,
    `CREATE TABLE IF NOT EXISTS customer_address (id_address INTEGER PRIMARY KEY AUTOINCREMENT, id_customer TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE, label TEXT, recipient_name TEXT, phone TEXT, address_text TEXT NOT NULL, province TEXT, city TEXT, district TEXT, postal_code TEXT, latitude TEXT, longitude TEXT, location_accuracy INTEGER, location_source TEXT, landmark TEXT, courier_note TEXT, is_default INTEGER NOT NULL DEFAULT 0, last_used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS web_order_session (id_session TEXT PRIMARY KEY, anonymous_token TEXT NOT NULL UNIQUE, id_customer TEXT REFERENCES customer_profile(id_customer), current_state TEXT NOT NULL DEFAULT 'START', cart_json TEXT NOT NULL DEFAULT '{}', context_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active', last_event_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS web_chat_message (id INTEGER PRIMARY KEY AUTOINCREMENT, id_session TEXT NOT NULL REFERENCES web_order_session(id_session) ON DELETE CASCADE, direction TEXT NOT NULL, message_type TEXT NOT NULL, text TEXT, payload_json TEXT, action_json TEXT, model_used TEXT, tokens_used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS payment_method (id_payment_method TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, account_name TEXT, account_number TEXT, bank_name TEXT, qris_public_id TEXT, qris_image_url TEXT, note TEXT, min_order_total INTEGER, max_order_total INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS payment_intent (id_payment_intent TEXT PRIMARY KEY, id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE, id_payment_method TEXT REFERENCES payment_method(id_payment_method), method_type TEXT NOT NULL, amount_due INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'instruction_shown', instruction_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS payment_proof (id_payment_proof TEXT PRIMARY KEY, id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE, cloudinary_public_id TEXT NOT NULL, secure_url TEXT NOT NULL, original_filename TEXT, file_format TEXT, file_size_bytes INTEGER, amount_claimed INTEGER, status TEXT NOT NULL DEFAULT 'pending', uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), verified_by TEXT, verified_at TEXT, admin_note TEXT)`,
    `CREATE TABLE IF NOT EXISTS order_status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE, order_status TEXT, payment_status TEXT, event_type TEXT NOT NULL, note TEXT, actor TEXT NOT NULL DEFAULT 'system', metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE TABLE IF NOT EXISTS failed_conversation (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, id_session TEXT, no_wa_pelanggan TEXT, user_message TEXT NOT NULL, current_state TEXT, reason TEXT NOT NULL, raw_ai_output TEXT, model_used TEXT, resolved INTEGER NOT NULL DEFAULT 0, admin_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), reviewed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS bot_setting (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_by TEXT)`,
    `CREATE TABLE IF NOT EXISTS bot_menu_item (id INTEGER PRIMARY KEY AUTOINCREMENT, surface TEXT NOT NULL DEFAULT 'public_ordering', label TEXT NOT NULL, action TEXT NOT NULL, value TEXT, payload_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
  ];

  for (const statement of createStatements) await client.execute(statement);

  const productColumns = [
    ['slug', 'slug TEXT'], ['kategori_id', 'kategori_id TEXT'], ['berat_gram', 'berat_gram INTEGER'], ['cloudinary_public_id', 'cloudinary_public_id TEXT'], ['image_url', 'image_url TEXT'], ['image_alt', 'image_alt TEXT'], ['tags_json', `tags_json TEXT NOT NULL DEFAULT '[]'`], ['is_featured', 'is_featured INTEGER NOT NULL DEFAULT 0'], ['is_best_seller', 'is_best_seller INTEGER NOT NULL DEFAULT 0'], ['sort_order', 'sort_order INTEGER NOT NULL DEFAULT 0'], ['created_at', `created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'`], ['updated_at', `updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'`],
  ] as const;
  for (const [column, ddl] of productColumns) await addColumnIfMissing(client, 'produk', column, ddl);

  const detailColumns = [
    ['id_varian', 'id_varian TEXT'], ['nama_produk_snapshot', 'nama_produk_snapshot TEXT'], ['nama_varian_snapshot', 'nama_varian_snapshot TEXT'], ['berat_gram_snapshot', 'berat_gram_snapshot INTEGER'], ['subtotal', 'subtotal INTEGER NOT NULL DEFAULT 0'],
  ] as const;
  for (const [column, ddl] of detailColumns) await addColumnIfMissing(client, 'detail_transaksi', column, ddl);

  const txColumns = [
    ['id_customer', 'id_customer TEXT'], ['id_session', 'id_session TEXT'], ['id_address', 'id_address INTEGER'], ['invoice_url', 'invoice_url TEXT'], ['order_status', `order_status TEXT NOT NULL DEFAULT 'draft'`], ['payment_status', `payment_status TEXT NOT NULL DEFAULT 'unpaid'`], ['payment_method', 'payment_method TEXT'], ['shipping_address_snapshot', 'shipping_address_snapshot TEXT'], ['shipping_location_json', 'shipping_location_json TEXT'], ['admin_note', 'admin_note TEXT'], ['verified_by', 'verified_by TEXT'], ['verified_at', 'verified_at TEXT'], ['kode_pesanan', 'kode_pesanan TEXT'], ['status_token', 'status_token TEXT'], ['updated_at', `updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'`],
  ] as const;
  for (const [column, ddl] of txColumns) await addColumnIfMissing(client, 'transaksi', column, ddl);

  console.log('public ordering migration completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
