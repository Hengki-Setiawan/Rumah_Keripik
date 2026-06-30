import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

// Helper to manually load environment variables from .env.local
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim();
        process.env[key] = value;
      }
    });
  }
}

async function migrate() {
  loadEnvLocal();

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || !token) {
    console.error('❌ Error: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing in .env.local');
    process.exit(1);
  }

  // Convert http/https or libsql url
  const httpUrl = url.replace(/^libsql:\/\//, 'https://');

  console.log('🔌 Connecting to Turso database:', httpUrl);
  const client = createClient({
    url: httpUrl,
    authToken: token,
  });

  console.log('⚡ Starting v2 migrations...');

  // 1. Create memory_pelanggan
  console.log('Creating memory_pelanggan table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS memory_pelanggan (
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
  `);

  // 2. Create bukti_pembayaran
  console.log('Creating bukti_pembayaran table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bukti_pembayaran (
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
  `);

  // 3. Create waitlist_produk
  console.log('Creating waitlist_produk table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS waitlist_produk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL REFERENCES pelanggan_chatbot(no_wa_pelanggan) ON DELETE CASCADE,
      id_produk TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'wa' CHECK (channel IN ('wa', 'telegram')),
      sudah_dinotif INTEGER NOT NULL DEFAULT 0,
      waktu_daftar TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `);

  // 4. Create rating_pelanggan
  console.log('Creating rating_pelanggan table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS rating_pelanggan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL,
      id_transaksi TEXT,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      feedback_text TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `);

  // 5. Create skill_library
  console.log('Creating skill_library table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS skill_library (
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
  `);

  // 6. Create lokasi_pelanggan
  console.log('Creating lokasi_pelanggan table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS lokasi_pelanggan (
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
  `);

  // 7. Add columns to transaksi table
  console.log('Adding new columns to transaksi table...');
  const alterCommands = [
    `ALTER TABLE transaksi ADD COLUMN nama_penerima TEXT`,
    `ALTER TABLE transaksi ADD COLUMN alamat_penerima TEXT`,
    `ALTER TABLE transaksi ADD COLUMN no_hp_penerima TEXT`,
    `ALTER TABLE transaksi ADD COLUMN bukti_transfer_url TEXT`,
    `ALTER TABLE transaksi ADD COLUMN sumber_order TEXT DEFAULT 'Offline'`,
    `ALTER TABLE transaksi ADD COLUMN lat_pengiriman TEXT`,
    `ALTER TABLE transaksi ADD COLUMN lng_pengiriman TEXT`,
    `ALTER TABLE transaksi ADD COLUMN jarak_km_dari_gudang TEXT`
  ];

  for (const cmd of alterCommands) {
    try {
      await client.execute(cmd);
      console.log(`  ✓ Executed: ${cmd}`);
    } catch (err: any) {
      if (err.message && err.message.includes('duplicate column name')) {
        console.log(`  ⚠ Column already exists (skipped): ${cmd.split('ADD COLUMN ')[1]}`);
      } else {
        console.warn(`  ⚠ Command skipped: ${err.message}`);
      }
    }
  }

  console.log('🎉 Migrations successfully completed!');
  process.exit(0);
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
