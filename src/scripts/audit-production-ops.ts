import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { asc, desc, like } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { paymentProof, produk, produkVarian, transaksi, workerJob } = await import('@/lib/schema');

  const smokeOrders = await db
    .select({
      id: transaksi.id_transaksi,
      code: transaksi.kode_pesanan,
      total: transaksi.total_bayar,
      payment: transaksi.payment_status,
      status: transaksi.order_status,
      name: transaksi.nama_penerima,
      created: transaksi.waktu_simpan,
    })
    .from(transaksi)
    .where(like(transaksi.nama_penerima, '%Smoke%'))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(20);

  const recentProofs = await db
    .select({
      id: paymentProof.id_payment_proof,
      orderId: paymentProof.id_transaksi,
      status: paymentProof.status,
      amount: paymentProof.amount_claimed,
      uploaded: paymentProof.uploaded_at,
    })
    .from(paymentProof)
    .orderBy(desc(paymentProof.uploaded_at))
    .limit(10);

  const lowVariants = await db
    .select({
      id: produkVarian.id_varian,
      productId: produkVarian.id_produk,
      name: produkVarian.nama_varian,
      stock: produkVarian.stok,
    })
    .from(produkVarian)
    .orderBy(asc(produkVarian.stok))
    .limit(10);

  const lowProducts = await db
    .select({
      id: produk.id_produk,
      name: produk.nama_produk,
      stock: produk.stok_gudang_utama,
    })
    .from(produk)
    .orderBy(asc(produk.stok_gudang_utama))
    .limit(10);

  const recentWorkerJobs = await db
    .select({
      id: workerJob.id,
      type: workerJob.type,
      status: workerJob.status,
      attempts: workerJob.attempts,
      error: workerJob.error_message,
      updated: workerJob.updated_at,
    })
    .from(workerJob)
    .orderBy(desc(workerJob.updated_at))
    .limit(10);

  console.log(JSON.stringify({
    ok: true,
    smokeOrders,
    recentProofs,
    lowVariants,
    lowProducts,
    recentWorkerJobs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
