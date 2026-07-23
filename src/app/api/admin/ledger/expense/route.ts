import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordExpense, ensureDefaultCategories } from '@/services/ledger-service';
import { requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError } from '@/lib/admin-actor';
import { logAdminAudit } from '@/lib/admin-audit';

const Schema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().int().positive(),
  note: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  let actor = 'admin';
  try {
    const role = await requireAdminRole('ledger:write');
    actor = role.actor;
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Admin tidak punya izin' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await recordExpense(parsed.data.categoryId, parsed.data.amount, parsed.data.note, actor);
    await logAdminAudit({ actor, action: 'record_expense', resourceType: 'ledger', resourceId: result.id, metadata: { amount: parsed.data.amount, categoryId: parsed.data.categoryId } });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 400 });
  }
}
