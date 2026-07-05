import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { orderDocument, orderStatusHistory } from '@/lib/schema';
import { safeJsonStringify } from '@/lib/json-utils';
import { and, eq, sql } from 'drizzle-orm';
import { isUnauthorizedAdminError, requireAdminActor } from '@/lib/admin-actor';

const PrintLogSchema = z.object({
  orderId: z.string().min(1),
  documentType: z.enum(['proforma', 'receipt', 'packing-label']),
});

export async function POST(req: Request) {
  const parsed = PrintLogSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload tidak valid' }, { status: 400 });

  try {
    const actor = await requireAdminActor();
    await db.insert(orderStatusHistory).values({
      id_transaksi: parsed.data.orderId,
      event_type: 'DOCUMENT_PRINTED',
      actor,
      metadata_json: safeJsonStringify({ documentType: parsed.data.documentType }),
    });
    await db
      .update(orderDocument)
      .set({ print_count: sql`${orderDocument.print_count} + 1`, last_printed_at: sql`(datetime('now', 'utc'))` })
      .where(and(eq(orderDocument.id_transaksi, parsed.data.orderId), eq(orderDocument.document_type, parsed.data.documentType)));
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    return NextResponse.json({ ok: false, error: 'Gagal mencatat print dokumen' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
