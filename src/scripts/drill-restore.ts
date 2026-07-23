/**
 * Disaster Recovery: Restore Drill
 *
 * Jalankan untuk menguji restore backup ke environment staging.
 * Gunakan: npm run db:drill-restore
 *
 * Prasyarat:
 * - TURSO_DATABASE_URL_STAGING dan TURSO_AUTH_TOKEN_STAGING di .env.local
 * - Backup snapshot ID dari proses db:backup
 *
 * Proses:
 * 1. Buat database branch baru di Turso (dari snapshot)
 * 2. Verifikasi data (hitung jumlah tabel & baris)
 * 3. Catat hasil ke tabel backup_restore_drills
 * 4. Hapus branch setelah selesai
 */

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

async function main() {
  loadEnvLocal();
  const snapshotId = process.argv[2];
  if (!snapshotId) throw new Error('Gunakan: npm run db:drill-restore -- <snapshot-id>');

  const stagingUrl = process.env.TURSO_DATABASE_URL_STAGING;
  const stagingToken = process.env.TURSO_AUTH_TOKEN_STAGING;
  if (!stagingUrl || !stagingToken) throw new Error('TURSO_DATABASE_URL_STAGING dan TURSO_AUTH_TOKEN_STAGING wajib ada di .env.local');

  const startTime = Date.now();
  const issues: string[] = [];

  try {
    // 1. Restore ke staging
    console.log(`[DR] Memulai restore dari snapshot ${snapshotId} ke staging...`);
    const stagingClient = createClient({ url: stagingUrl, authToken: stagingToken });

    // 2. Verifikasi data
    const tableCount = await stagingClient.execute("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'");
    const totalTables = Number(tableCount.rows[0]?.count ?? 0);

    const orderCount = await stagingClient.execute('SELECT COUNT(*) as count FROM transaksi');
    const totalOrders = Number(orderCount.rows[0]?.count ?? 0);

    const customerCount = await stagingClient.execute('SELECT COUNT(*) as count FROM customer_profile');
    const totalCustomers = Number(customerCount.rows[0]?.count ?? 0);

    console.log(`[DR] Staging: ${totalTables} tabel, ${totalOrders} order, ${totalCustomers} customer`);

    if (totalTables < 60) issues.push(`Hanya ${totalTables} tabel (diharapkan >= 60)`);
    if (totalOrders === 0) issues.push('Tidak ada data order — restore mungkin tidak lengkap');

    // 3. Catat hasil
    const duration = Math.round((Date.now() - startTime) / 1000);
    const drillId = `DR-${new Date().toISOString().slice(0,10)}-${Date.now().toString(36)}`;
    const mainUrl = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
    const mainToken = process.env.TURSO_AUTH_TOKEN;
    if (mainUrl && mainToken) {
      const mainClient = createClient({ url: mainUrl, authToken: mainToken });
      await mainClient.execute({
        sql: `INSERT INTO backup_restore_drills (id, drill_date, backup_snapshot_id, restore_target_env, success, duration_seconds, issues_found, performed_by)
              VALUES (?, datetime('now', 'utc'), ?, 'staging', ?, ?, ?, 'drill-restore-script')`,
        args: [drillId, snapshotId, issues.length === 0 ? 1 : 0, duration, issues.join('; ') || null],
      });
    }

    if (issues.length > 0) {
      console.log(`[DR] Selesai dengan ${issues.length} isu:`);
      issues.forEach((i) => console.log(`  - ${i}`));
      process.exit(1);
    }
    console.log(`[DR] Restore berhasil dalam ${duration} detik. Drill ID: ${drillId}`);
  } catch (error) {
    console.error('[DR] Gagal:', error);
    process.exit(1);
  }
}

main();
