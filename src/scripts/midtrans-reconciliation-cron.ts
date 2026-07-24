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
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!url || !authToken || !serverKey) throw new Error('Env vars wajib ada');
  const client = createClient({ url, authToken });

  const pendingOrders = await client.execute(`
    SELECT id_transaksi, kode_pesanan, payment_method FROM transaksi
    WHERE status = 'awaiting_payment'
    AND created_at < datetime('now', '-60 minutes')
    AND payment_method IS NOT NULL
  `);

  let reconciled = 0;
  for (const row of pendingOrders.rows) {
    const orderId = row.id_transaksi as string;
    try {
      const statusRes = await fetch(`https://api.sandbox.midtrans.com/v2/${orderId}/status`, {
        headers: { Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}` },
      });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      const transactionStatus = statusData.transaction_status as string;
      const fraudStatus = statusData.fraud_status as string;

      if ((transactionStatus === 'settlement' || transactionStatus === 'capture') &&
          (!fraudStatus || fraudStatus === 'accept')) {
        await client.execute({
          sql: `UPDATE transaksi SET status = 'paid', updated_at = datetime('now', 'utc') WHERE id_transaksi = ?`,
          args: [orderId],
        });
        reconciled++;
        console.log(`[RECONCILE] Order ${orderId} → paid (Midtrans sync)`);
      } else if (transactionStatus === 'expire' || transactionStatus === 'deny' || transactionStatus === 'cancel') {
        await client.execute({
          sql: `UPDATE transaksi SET status = 'cancelled', updated_at = datetime('now', 'utc') WHERE id_transaksi = ?`,
          args: [orderId],
        });
        reconciled++;
        console.log(`[RECONCILE] Order ${orderId} → cancelled (${transactionStatus})`);
      }
    } catch (err) {
      console.error(`[RECONCILE] Error checking order ${orderId}:`, err);
    }
  }

  console.log(`[RECONCILE] Selesai: ${reconciled}/${pendingOrders.rows.length} order diperbarui`);
  client.close();
}

main().catch((e) => {
  console.error('[RECONCILE] Gagal:', e);
  process.exit(1);
});
