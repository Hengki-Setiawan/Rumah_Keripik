import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentOcrResult } from '@/lib/schema';

type OcrResult = {
  engine?: string;
  proofId: string;
  orderId: string;
  extractedText?: string | null;
  extractedAmount?: number | null;
  reference?: string | null;
  statusKeywords?: string[];
  score?: number;
  warnings?: string[];
  summary?: string | null;
};

export async function savePaymentOcrResult(result: OcrResult, workerJobId?: number) {
  const existing = await db
    .select({ id: paymentOcrResult.id })
    .from(paymentOcrResult)
    .where(eq(paymentOcrResult.id_payment_proof, result.proofId))
    .limit(1);

  const values = {
    id_payment_proof: result.proofId,
    id_transaksi: result.orderId,
    worker_job_id: workerJobId ?? null,
    engine: result.engine || 'rule_based_mvp',
    extracted_text: result.extractedText ?? null,
    extracted_amount: result.extractedAmount ?? null,
    reference_number: result.reference ?? null,
    status_keywords_json: JSON.stringify(result.statusKeywords || []),
    score: result.score ?? 0,
    warnings_json: JSON.stringify(result.warnings || []),
    summary: result.summary ?? null,
    raw_json: JSON.stringify(result),
    updated_at: sql`(datetime('now', 'utc'))`,
  };

  if (existing[0]) {
    await db.update(paymentOcrResult).set(values).where(eq(paymentOcrResult.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db.insert(paymentOcrResult).values(values).returning({ id: paymentOcrResult.id });
  return inserted?.id;
}
