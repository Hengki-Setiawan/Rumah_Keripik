import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sosEvents } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const ResolveSchema = z.object({ id: z.number(), note: z.string().max(500).optional() });

export async function GET() {
  const events = await db
    .select()
    .from(sosEvents)
    .orderBy(desc(sosEvents.createdAt))
    .limit(50);
  return NextResponse.json({ ok: true, events });
}

export async function PATCH(req: Request) {
  const body = ResolveSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

  await db.update(sosEvents).set({
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    note: body.data.note || null,
  }).where(eq(sosEvents.id, body.data.id));

  return NextResponse.json({ ok: true });
}
