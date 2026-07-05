import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentProof, transaksi } from '@/lib/schema';
import { scorePaymentProof } from '@/lib/payment-proof-scoring';

export async function GET() {
  const proofs = await db
    .select({
      proof: paymentProof,
      order: {
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        total_bayar: transaksi.total_bayar,
        nama_penerima: transaksi.nama_penerima,
        payment_status: transaksi.payment_status,
        order_status: transaksi.order_status,
      },
    })
    .from(paymentProof)
    .leftJoin(transaksi, eq(paymentProof.id_transaksi, transaksi.id_transaksi))
    .orderBy(desc(paymentProof.uploaded_at));
  const duplicateCounts = await db
    .select({ id_transaksi: paymentProof.id_transaksi, total: sql<number>`count(*)` })
    .from(paymentProof)
    .groupBy(paymentProof.id_transaksi);
  const countByOrder = new Map(duplicateCounts.map((row) => [row.id_transaksi, Number(row.total)]));

  return NextResponse.json({
    ok: true,
    proofs: proofs.map((row) => ({
      ...row,
      verification: withDuplicateWarning(normalizeVerification(scorePaymentProof(row.proof, row.order)), countByOrder.get(row.proof.id_transaksi) || 0),
    })),
  });
}

function normalizeVerification(verification: { score: number; warnings: string[]; level: string }) {
  const level: 'safe' | 'warning' | 'danger' = verification.level === 'safe' || verification.level === 'warning' ? verification.level : 'danger';
  return { ...verification, level };
}

function withDuplicateWarning<T extends { score: number; warnings: string[]; level: 'safe' | 'warning' | 'danger' }>(verification: T, proofCount: number): T {
  if (proofCount <= 1) return verification;
  const score = Math.max(0, verification.score - 10);
  const level: 'safe' | 'warning' | 'danger' = score >= 80 ? 'safe' : score >= 55 ? 'warning' : 'danger';
  return {
    ...verification,
    score,
    level,
    warnings: [...verification.warnings, `Order memiliki ${proofCount} bukti pembayaran; cek kemungkinan upload ulang/duplikat`],
  };
}
