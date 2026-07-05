import { NextResponse } from 'next/server';
import { desc, eq, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, paymentOcrResult, paymentProof, transaksi, workerJob } from '@/lib/schema';
import { scorePaymentProof } from '@/lib/payment-proof-scoring';
import { applyDuplicateSignalsToVerification, detectPaymentDuplicateSignals } from '@/lib/payment-duplicate';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const [proof] = await db.select().from(paymentProof).where(eq(paymentProof.id_payment_proof, id)).limit(1);
  if (!proof) return NextResponse.json({ ok: false, error: 'Bukti pembayaran tidak ditemukan' }, { status: 404 });

  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, proof.id_transaksi)).limit(1);
  const items = order ? await db.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, order.id_transaksi)) : [];
  const siblingProofs = await db.select().from(paymentProof).where(eq(paymentProof.id_transaksi, proof.id_transaksi));
  const [ocrResult] = await db
    .select()
    .from(paymentOcrResult)
    .where(eq(paymentOcrResult.id_payment_proof, id))
    .limit(1);
  const [ocrJob] = await db
    .select()
    .from(workerJob)
    .where(like(workerJob.payload_json, `%${id}%`))
    .orderBy(desc(workerJob.updated_at))
    .limit(1);

  const verification = scorePaymentProof(proof, order ?? null);
  const duplicateSignals = await detectPaymentDuplicateSignals(proof);
  const finalVerification = siblingProofs.length > 1
    ? {
        ...verification,
        score: Math.max(0, verification.score - 10),
        level: Math.max(0, verification.score - 10) >= 80 ? 'safe' : Math.max(0, verification.score - 10) >= 55 ? 'warning' : 'danger',
        warnings: [...verification.warnings, `Ada ${siblingProofs.length} bukti untuk order ini; cek bukti terbaru dan duplikat.`],
      }
    : verification;
  const enrichedVerification = applyDuplicateSignalsToVerification(normalizeVerification(finalVerification), duplicateSignals);

  return NextResponse.json({ ok: true, proof, order, items, verification: enrichedVerification, siblingProofs, duplicateSignals, ocrResult: ocrResult ?? null, ocrJob: ocrJob ?? null });
}

function normalizeVerification(verification: { score: number; warnings: string[]; level: string }) {
  const level: 'safe' | 'warning' | 'danger' = verification.level === 'safe' || verification.level === 'warning' ? verification.level : 'danger';
  return { ...verification, level };
}
