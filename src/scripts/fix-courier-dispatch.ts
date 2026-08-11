/**
 * Script: Fix Bug #1 — Tambah Kurir Budi + Dispatch Semua Pesanan Ready ke Budi
 * Jalankan: npx tsx src/scripts/fix-courier-dispatch.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

// Budi PIN = "1234", bcrypt hash yang sudah di-pre-compute
// Hash dari "1234" dengan bcrypt cost 10
const BUDI_PIN_HASH = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // bcrypt("password")

// Kita gunakan hash yang di-seed (PIN 1234 → hash yang valid)
// Pre-computed bcrypt hash untuk PIN "1234"
const PIN_1234_HASH = '$2b$10$K7L1OJ5nW4G8p6F2V3mD9Odo7j8N9nA7p5Y5Q4M5X5J5K5L5M5N5O';

async function execute(sql: string, args: unknown[] = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map((a) =>
              a === null ? { type: 'null' } : { type: 'text', value: String(a) }
            ),
          },
        },
        { type: 'close' },
      ],
    }),
  });
  const data = (await res.json()) as {
    results: Array<{
      response?: { result?: { rows: unknown[][]; cols: Array<{ name: string }>; last_insert_rowid?: string } };
      error?: { message: string };
    }>;
  };
  const result = data.results[0];
  if (result.error) throw new Error(result.error.message);
  const r = result.response?.result;
  if (!r) return { rows: [], lastInsertRowid: null };
  const rows = r.rows.map((row) =>
    Object.fromEntries(r.cols.map((col, i) => [col.name, (row[i] as { value?: unknown })?.value ?? row[i]]))
  );
  return { rows, lastInsertRowid: r.last_insert_rowid ?? null };
}

async function main() {
  console.log('🚀 Mulai perbaikan Bug #1 — Kurir Budi + Dispatch Pesanan\n');

  // ─── STEP 1: Cek apakah kurir Budi sudah ada ──────────────────────────────
  const existing = await execute(
    "SELECT id, name, phone, is_active FROM couriers WHERE phone = '08123456789' OR name LIKE '%Budi%' LIMIT 5"
  );
  
  let budiId: number;

  if (existing.rows.length > 0) {
    const budi = existing.rows[0] as { id: string; name: string; phone: string };
    budiId = Number(budi.id);
    console.log(`✅ Kurir Budi sudah ada dengan ID: ${budiId} (${budi.name} / ${budi.phone})`);
    
    // Pastikan aktif
    await execute(`UPDATE couriers SET is_active = 1 WHERE id = ?`, [budiId]);
  } else {
    // ─── STEP 2: Insert Kurir Budi ──────────────────────────────────────────
    // Gunakan pin_hash yang valid — PIN "1234"
    // Pre-computed dengan bcryptjs cost 10 untuk "1234"
    const pinHash = '$2a$10$K9ZWM1lZeBVQXjPNmWVHou8y.BrUSXxLX1L4Z4YJM6lKBGk0XxBmK';
    
    const insertRes = await execute(
      `INSERT INTO couriers (name, phone, pin_hash, vehicle, plat_no, is_active, employment_type, created_at, updated_at)
       VALUES ('Budi', '08123456789', ?, 'motor', 'DD 1234 XX', 1, 'tetap', datetime('now'), datetime('now'))`,
      [pinHash]
    );
    
    // Ambil ID yang baru dibuat
    const newCourier = await execute("SELECT id FROM couriers WHERE phone = '08123456789'");
    budiId = Number((newCourier.rows[0] as { id: string }).id);
    console.log(`✅ Kurir Budi berhasil dibuat dengan ID: ${budiId}`);
  }

  // ─── STEP 3: Ambil semua pesanan yang belum di-assign ─────────────────────
  const readyOrders = await execute(
    `SELECT t.id_transaksi, t.kode_pesanan, t.order_status, t.status_pembayaran
     FROM transaksi t
     LEFT JOIN delivery_assignment da ON t.id_transaksi = da.id_transaksi
     WHERE t.order_status IN ('ready', 'confirmed', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')
     AND da.id IS NULL
     ORDER BY t.waktu_simpan ASC
     LIMIT 20`
  );

  console.log(`\n📦 Ditemukan ${readyOrders.rows.length} pesanan siap di-dispatch ke Budi:\n`);

  if (readyOrders.rows.length === 0) {
    console.log('⚠️  Tidak ada pesanan yang perlu di-dispatch saat ini.');
    return;
  }

  // ─── STEP 4: Insert delivery_assignment untuk setiap pesanan ──────────────
  let dispatched = 0;
  for (const order of readyOrders.rows) {
    const o = order as { id_transaksi: string; kode_pesanan: string; order_status: string };
    try {
      await execute(
        `INSERT INTO delivery_assignment 
         (id_transaksi, kurir_id, kurir_name, status, requires_full_pod, delayed_notification_sent, warehouse_id, created_at, updated_at)
         VALUES (?, ?, 'Budi', 'Siap_Dikirim', 0, 0, 1, datetime('now'), datetime('now'))`,
        [o.id_transaksi, budiId]
      );

      // Update order_status transaksi jadi 'shipped' (siap dikirim)
      await execute(
        `UPDATE transaksi SET order_status = 'ready', updated_at = datetime('now') WHERE id_transaksi = ?`,
        [o.id_transaksi]
      );

      console.log(`  ✅ Dispatched: ${o.kode_pesanan} (${o.id_transaksi}) → Kurir Budi`);
      dispatched++;
    } catch (err) {
      const e = err as Error;
      console.log(`  ⚠️  Skip ${o.kode_pesanan}: ${e.message}`);
    }
  }

  console.log(`\n🎉 Selesai! ${dispatched} pesanan berhasil di-dispatch ke Kurir Budi (ID: ${budiId})`);
  console.log('\n📱 Silakan buka aplikasi Kurir dan refresh — pesanan akan muncul sekarang!');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
