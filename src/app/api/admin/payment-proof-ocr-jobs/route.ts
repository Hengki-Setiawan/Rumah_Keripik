import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workerJob } from '@/lib/schema';

export async function GET() {
  const jobs = await db
    .select({
      id: workerJob.id,
      status: workerJob.status,
      priority: workerJob.priority,
      attempts: workerJob.attempts,
      payload_json: workerJob.payload_json,
      result_json: workerJob.result_json,
      error_message: workerJob.error_message,
      created_at: workerJob.created_at,
      updated_at: workerJob.updated_at,
    })
    .from(workerJob)
    .where(eq(workerJob.type, 'payment_proof_ocr_assist'))
    .orderBy(desc(workerJob.created_at))
    .limit(50);

  return NextResponse.json({ ok: true, jobs });
}
