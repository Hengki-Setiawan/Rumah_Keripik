import { NextResponse } from 'next/server';
import { getTaskDistribution } from '@/services/ai-budget-service';
import { requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('audit:read');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }
  const data = await getTaskDistribution();
  return NextResponse.json({ ok: true, data });
}
