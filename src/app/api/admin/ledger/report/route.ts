import { NextResponse } from 'next/server';
import { getPeriodReport, getCategories } from '@/services/ledger-service';
import { requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('ledger:view');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Admin tidak punya izin' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodStart = searchParams.get('periodStart') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const periodEnd = searchParams.get('periodEnd') || new Date().toISOString().slice(0, 10);

  try {
    const report = await getPeriodReport(periodStart, periodEnd);
    const categories = await getCategories();
    return NextResponse.json({ ok: true, report, categories });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
