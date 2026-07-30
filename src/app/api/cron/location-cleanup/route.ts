import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierLocations } from '@/lib/schema';
import { sql, lt } from 'drizzle-orm';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    const result = await db.delete(courierLocations)
      .where(lt(courierLocations.receivedAt, cutoff));

    return NextResponse.json({
      ok: true,
      deleted: result.rowsAffected ?? 0,
      cutoff,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
