import { and, eq, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentOcrResult, paymentProof } from '@/lib/schema';

export type DuplicateSignal = {
  type: 'same_order_multiple_proofs' | 'same_reference' | 'same_public_id' | 'same_amount_file_size';
  severity: 'warning' | 'danger';
  message: string;
};

type DbLike = Pick<typeof db, 'select'>;

export async function detectPaymentDuplicateSignals(proof: typeof paymentProof.$inferSelect, database: DbLike = db) {
  const signals: DuplicateSignal[] = [];
  const siblingProofs = await database.select().from(paymentProof).where(eq(paymentProof.id_transaksi, proof.id_transaksi));
  if (siblingProofs.length > 1) {
    signals.push({ type: 'same_order_multiple_proofs', severity: 'warning', message: `Order memiliki ${siblingProofs.length} bukti pembayaran.` });
  }

  const samePublicId = await database
    .select({ id: paymentProof.id_payment_proof })
    .from(paymentProof)
    .where(and(eq(paymentProof.cloudinary_public_id, proof.cloudinary_public_id), ne(paymentProof.id_payment_proof, proof.id_payment_proof)))
    .limit(1);
  if (samePublicId[0]) signals.push({ type: 'same_public_id', severity: 'danger', message: 'Cloudinary public ID sudah pernah dipakai bukti lain.' });

  if (proof.amount_claimed != null && proof.file_size_bytes != null) {
    const sameAmountSize = await database
      .select({ id: paymentProof.id_payment_proof })
      .from(paymentProof)
      .where(and(eq(paymentProof.amount_claimed, proof.amount_claimed), eq(paymentProof.file_size_bytes, proof.file_size_bytes), ne(paymentProof.id_payment_proof, proof.id_payment_proof)))
      .limit(1);
    if (sameAmountSize[0]) signals.push({ type: 'same_amount_file_size', severity: 'warning', message: 'Nominal dan ukuran file sama dengan bukti lain; cek kemungkinan duplikat.' });
  }

  const [ocr] = await database.select().from(paymentOcrResult).where(eq(paymentOcrResult.id_payment_proof, proof.id_payment_proof)).limit(1);
  if (ocr?.reference_number) {
    const sameReference = await database
      .select({ id: paymentOcrResult.id_payment_proof })
      .from(paymentOcrResult)
      .where(and(eq(paymentOcrResult.reference_number, ocr.reference_number), ne(paymentOcrResult.id_payment_proof, proof.id_payment_proof)))
      .limit(1);
    if (sameReference[0]) signals.push({ type: 'same_reference', severity: 'danger', message: `Nomor referensi ${ocr.reference_number} sudah pernah muncul di bukti lain.` });
  }

  return signals;
}

export function applyDuplicateSignalsToVerification<T extends { score: number; warnings: string[]; level: 'safe' | 'warning' | 'danger' }>(verification: T, signals: DuplicateSignal[]): T {
  if (signals.length === 0) return verification;
  const penalty = signals.some((signal) => signal.severity === 'danger') ? 25 : 10;
  const score = Math.max(0, verification.score - penalty);
  const level: 'safe' | 'warning' | 'danger' = score >= 80 ? 'safe' : score >= 55 ? 'warning' : 'danger';
  return { ...verification, score, level, warnings: [...verification.warnings, ...signals.map((signal) => signal.message)] };
}
