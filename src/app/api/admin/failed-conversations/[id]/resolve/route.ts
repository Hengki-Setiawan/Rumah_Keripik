import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { failedConversation } from '@/lib/schema';
import { adminAuthErrorResponse, requireAdminRole } from '@/lib/admin-actor';

type RouteContext = { params: Promise<{ id: string }> };
const ResolveSchema = z.object({ note: z.string().max(500).optional() });

export async function POST(req: Request, context: RouteContext) {
  try {
    await requireAdminRole('chat:manage');
    const { id } = await context.params;
    const parsed = ResolveSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload tidak valid' }, { status: 400 });
    await db.update(failedConversation).set({ resolved: 1, admin_note: parsed.data.note || null, reviewed_at: sql`(datetime('now', 'utc'))` }).where(eq(failedConversation.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_FAILED_CONVERSATION_RESOLVE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
