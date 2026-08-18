import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client/web';

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

// v28: tambahkan index yang didefinisikan di schema.ts tapi belum pernah
// dibuat di database live (tabel dibuat script migrasi manual tanpa DDL index).
// Semua additive & idempotent (CREATE INDEX IF NOT EXISTS). Aman dijalankan ulang.
const statements = [
  `CREATE INDEX IF NOT EXISTS idx_bot_menu_surface_active ON bot_menu_item(surface, is_active, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_address_customer ON customer_address(id_customer, last_used_at)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_address_default ON customer_address(id_customer, is_default)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_identity_customer ON customer_identity(id_customer)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_last_active ON customer_profile(last_active_at)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_profile(phone)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_assignment_tx ON delivery_assignment(id_transaksi)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_route_point_route ON delivery_route_point(route_id, route_date)`,
  `CREATE INDEX IF NOT EXISTS idx_failed_conversation_created ON failed_conversation(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_failed_conversation_reason ON failed_conversation(reason)`,
  `CREATE INDEX IF NOT EXISTS idx_failed_conversation_resolved ON failed_conversation(resolved)`,
  `CREATE INDEX IF NOT EXISTS idx_geofence_type ON geofence_zones(zone_type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_courier_date_unique ON courier_kpi_daily(courier_id, kpi_date)`,
  `CREATE INDEX IF NOT EXISTS idx_order_status_history_event ON order_status_history(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_order_status_history_transaksi ON order_status_history(id_transaksi, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_intent_status ON payment_intent(status)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_intent_transaksi ON payment_intent(id_transaksi)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_method_active ON payment_method(is_active, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_method_type ON payment_method(type)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_active_kategori ON produk(is_active, kategori_id)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_best_seller ON produk(is_active, is_best_seller, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_featured ON produk(is_active, is_featured, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_kategori_active_sort ON produk_kategori(is_active, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_kategori_slug ON produk_kategori(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_media_primary ON produk_media(id_produk, is_primary)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_media_produk ON produk_media(id_produk, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_media_varian ON produk_media(id_varian)`,
  `CREATE INDEX IF NOT EXISTS idx_produk_slug ON produk(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_transaksi_order_status ON transaksi(order_status)`,
  `CREATE INDEX IF NOT EXISTS idx_transaksi_payment_status ON transaksi(payment_status)`,
  `CREATE INDEX IF NOT EXISTS idx_varian_produk_active ON produk_varian(id_produk, is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_varian_sku ON produk_varian(sku)`,
  `CREATE INDEX IF NOT EXISTS idx_varian_stock ON produk_varian(is_active, stok)`,
  `CREATE INDEX IF NOT EXISTS idx_web_chat_message_session_time ON web_chat_message(id_session, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_web_chat_message_type ON web_chat_message(message_type)`,
  `CREATE INDEX IF NOT EXISTS idx_web_order_session_customer ON web_order_session(id_customer)`,
  `CREATE INDEX IF NOT EXISTS idx_web_order_session_status ON web_order_session(status, last_event_at)`,
  `CREATE INDEX IF NOT EXISTS idx_web_order_session_token ON web_order_session(anonymous_token)`,
];

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  let created = 0;
  let errors = 0;
  for (const statement of statements) {
    try {
      const existing = await client.execute(
        `SELECT 1 FROM sqlite_master WHERE type='index' AND name='${statement.match(/INDEX IF NOT EXISTS (\w+)/)?.[1]}'`
      );
      if (existing.rows.length > 0) continue;
      await client.execute(statement);
      created += 1;
      console.log(`created: ${statement.match(/INDEX IF NOT EXISTS (\w+)/)?.[1]}`);
    } catch (error) {
      errors += 1;
      console.error(`ERROR: ${statement}\n  ${(error as Error).message}`);
    }
  }
  console.log(`\nv28 indexes: created=${created}, errors=${errors}`);
  if (errors > 0) process.exitCode = 1;
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
