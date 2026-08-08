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

function earningId(prefix: string): string {
  return `EARN-BF-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  const rawFee = Number(process.env.COURIER_BASE_FEE || 10000);
  const baseFee = Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee) : 10000;

  const { rows } = await client.execute(`
    SELECT da.id AS assignment_id,
           da.kurir_id,
           da.id_transaksi,
           da.delivered_at
    FROM delivery_assignment da
    WHERE da.status = 'Terkirim'
      AND da.kurir_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM courier_earnings ce
        WHERE ce.delivery_assignment_id = da.id
      )
    ORDER BY da.delivered_at ASC
  `);

  console.log(`Delivery Terkirim tanpa earning: ${rows.length}`);

  let inserted = 0;
  let failed = 0;
  for (const row of rows) {
    const assignmentId = Number(row.assignment_id);
    const courierId = Number(row.kurir_id);
    const orderId = String(row.id_transaksi);
    const deliveredAt = row.delivered_at ? String(row.delivered_at) : undefined;
    try {
      await client.execute({
        sql: `INSERT INTO courier_earnings
          (id, courier_id, delivery_assignment_id, order_id, base_fee, bonus_amount,
           status, earning_type, note, created_at)
          VALUES (?, ?, ?, ?, ?, 0, 'confirmed', 'per_delivery', 'Backfill delivery lama', ?)`,
        args: [
          earningId(String(assignmentId)),
          courierId,
          assignmentId,
          orderId,
          baseFee,
          deliveredAt || new Date().toISOString(),
        ],
      });
      inserted += 1;
    } catch (err) {
      failed += 1;
      console.error(`  Gagal assignment #${assignmentId}:`, err);
    }
  }

  console.log(`Backfill selesai: ${inserted} inserted, ${failed} failed (base_fee=${baseFee}).`);
  process.exit(failed > 0 && inserted === 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
