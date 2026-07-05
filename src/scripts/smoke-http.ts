import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
  const { db } = await import('@/lib/db');
  const { desc, eq } = await import('drizzle-orm');
  const { transaksi } = await import('@/lib/schema');

  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.payment_status, 'verified'))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(1);
  const [cod] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.payment_status, 'cod_approved'))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(1);

  const checks: Array<{ name: string; url: string; expect: number[] }> = [
    { name: 'public order page', url: `${baseUrl}/pesan`, expect: [200] },
    { name: 'public products api', url: `${baseUrl}/api/public/products`, expect: [200] },
    { name: 'public payment methods api', url: `${baseUrl}/api/public/payment-methods`, expect: [200] },
  ];

  if (order?.kode_pesanan && order.status_token) {
    checks.push({ name: 'status page verified', url: `${baseUrl}/pesan/status/${encodeURIComponent(order.kode_pesanan)}?token=${encodeURIComponent(order.status_token)}`, expect: [200] });
    checks.push({ name: 'receipt verified protected', url: `${baseUrl}/dokumen/order/${encodeURIComponent(order.id_transaksi)}/receipt`, expect: [200, 302, 307] });
    checks.push({ name: 'packing label verified protected', url: `${baseUrl}/dokumen/order/${encodeURIComponent(order.id_transaksi)}/packing-label`, expect: [200, 302, 307] });
  }
  if (cod?.id_transaksi) {
    checks.push({ name: 'packing label cod protected', url: `${baseUrl}/dokumen/order/${encodeURIComponent(cod.id_transaksi)}/packing-label`, expect: [200, 302, 307] });
  }

  const results = [];
  for (const check of checks) {
    const res = await fetch(check.url, { redirect: 'manual' });
    results.push({ name: check.name, status: res.status, ok: check.expect.includes(res.status) });
  }

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
