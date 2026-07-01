import { and, eq, or, sql } from 'drizzle-orm';
import { db } from './db';
import { workerHeartbeat, workerJob } from './schema';

export type WorkerJobType =
  | 'ai_learn'
  | 'geocode_address'
  | 'reembed_knowledge'
  | 'send_outbound_message'
  | 'refresh_location_zones';

export async function enqueueJob(
  type: WorkerJobType,
  payload: unknown,
  options: { priority?: number; maxAttempts?: number } = {},
) {
  const [inserted] = await db
    .insert(workerJob)
    .values({
      type,
      payload_json: JSON.stringify(payload),
      priority: options.priority ?? 5,
      max_attempts: options.maxAttempts ?? 3,
    })
    .returning({ id: workerJob.id });

  return inserted?.id;
}

export async function claimNextJob(workerId: string, lockSeconds = 90) {
  const [candidate] = await db
    .select()
    .from(workerJob)
    .where(
      and(
        or(
          eq(workerJob.status, 'pending'),
          and(eq(workerJob.status, 'processing'), sql`${workerJob.locked_until} < datetime('now', 'utc')`),
        ),
        sql`${workerJob.attempts} < ${workerJob.max_attempts}`,
      ),
    )
    .orderBy(workerJob.priority, workerJob.created_at)
    .limit(1);

  if (!candidate) return null;

  const lockedUntil = new Date(Date.now() + lockSeconds * 1000).toISOString();
  const claimed = await db
    .update(workerJob)
    .set({
      status: 'processing',
      locked_by: workerId,
      locked_until: lockedUntil,
      attempts: sql`${workerJob.attempts} + 1`,
      updated_at: sql`(datetime('now', 'utc'))`,
    })
    .where(
      and(
        eq(workerJob.id, candidate.id),
        or(
          eq(workerJob.status, 'pending'),
          and(eq(workerJob.status, 'processing'), sql`${workerJob.locked_until} < datetime('now', 'utc')`),
        ),
      ),
    )
    .returning();

  return claimed[0] || null;
}

export async function completeJob(id: number, result: unknown) {
  await db
    .update(workerJob)
    .set({
      status: 'completed',
      result_json: JSON.stringify(result ?? {}),
      error_message: null,
      locked_by: null,
      locked_until: null,
      updated_at: sql`(datetime('now', 'utc'))`,
    })
    .where(eq(workerJob.id, id));
}

export async function failJob(id: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const [job] = await db.select().from(workerJob).where(eq(workerJob.id, id)).limit(1);
  const shouldRetry = job ? job.attempts < job.max_attempts : false;

  await db
    .update(workerJob)
    .set({
      status: shouldRetry ? 'pending' : 'failed',
      error_message: message,
      locked_by: null,
      locked_until: null,
      updated_at: sql`(datetime('now', 'utc'))`,
    })
    .where(eq(workerJob.id, id));
}

export async function heartbeat(workerId: string, meta: unknown = {}) {
  await db
    .insert(workerHeartbeat)
    .values({
      worker_id: workerId,
      worker_name: process.env.WORKER_NAME || 'local-worker',
      status: 'online',
      last_seen_at: sql`(datetime('now', 'utc'))` as unknown as string,
      meta_json: JSON.stringify(meta),
    })
    .onConflictDoUpdate({
      target: workerHeartbeat.worker_id,
      set: {
        status: 'online',
        last_seen_at: sql`(datetime('now', 'utc'))`,
        meta_json: JSON.stringify(meta),
      },
    });
}

export async function getWorkerStatus() {
  const [counts] = await db
    .select({
      pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      processing: sql<number>`SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(workerJob);

  const workers = await db.select().from(workerHeartbeat);

  return {
    counts: {
      pending: counts?.pending ?? 0,
      processing: counts?.processing ?? 0,
      failed: counts?.failed ?? 0,
    },
    workers,
  };
}
