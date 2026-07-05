import { NextResponse } from 'next/server';
import { getWorkerStatus } from '@/lib/worker-queue';
import { db } from '@/lib/db';
import { workerJob } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const status = await getWorkerStatus();
    const latestJobs = await db.select().from(workerJob).orderBy(desc(workerJob.updated_at)).limit(10);
    const now = Date.now();

    const workers = status.workers.map((worker) => {
      const lastSeen = new Date(worker.last_seen_at + 'Z').getTime();
      const secondsAgo = Number.isFinite(lastSeen) ? Math.round((now - lastSeen) / 1000) : null;
      return {
        ...worker,
        seconds_ago: secondsAgo,
        online: secondsAgo !== null && secondsAgo <= 90,
      };
    });

    return NextResponse.json({
      ok: true,
      counts: status.counts,
      workers,
      latestJobs,
      online: workers.some((worker) => worker.online),
    });
  } catch (error) {
    console.error('[WorkerStatus]', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
