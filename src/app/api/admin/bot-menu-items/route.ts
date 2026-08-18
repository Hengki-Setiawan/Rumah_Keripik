import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { botMenuItem } from '@/lib/schema';
import { adminAuthErrorResponse, requireAdminRole } from '@/lib/admin-actor';

const BotMenuItemSchema = z.object({
  label: z.string().min(1).max(80),
  action: z.string().min(1).max(80).default('text_prompt'),
  value: z.string().max(200).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.number().int().min(0).max(1).default(1),
});

export async function GET() {
  try {
    await requireAdminRole('chat:manage');
    const items = await db
      .select()
      .from(botMenuItem)
      .where(eq(botMenuItem.surface, 'public_ordering'))
      .orderBy(asc(botMenuItem.sort_order), asc(botMenuItem.label));
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_BOT_MENU_ITEMS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('chat:manage');
    const parsed = BotMenuItemSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Data menu tidak valid' }, { status: 400 });

    await db.insert(botMenuItem).values({
      surface: 'public_ordering',
      label: parsed.data.label,
      action: parsed.data.action,
      value: parsed.data.value ?? parsed.data.label,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_BOT_MENU_ITEMS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminRole('chat:manage');
    const body = await req.json().catch(() => null) as { id?: number; data?: unknown } | null;
    if (!body?.id) return NextResponse.json({ ok: false, error: 'ID menu wajib diisi' }, { status: 400 });
    const parsed = BotMenuItemSchema.partial().safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Data menu tidak valid' }, { status: 400 });

    await db.update(botMenuItem).set(parsed.data).where(eq(botMenuItem.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('[ADMIN_BOT_MENU_ITEMS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
