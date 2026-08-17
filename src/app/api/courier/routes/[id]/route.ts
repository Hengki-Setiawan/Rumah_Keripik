import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { claimRoute, releaseRoute, startRoute } from '@/lib/route-assign';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const action = body.action ?? 'claim';

    switch (action) {
      case 'claim': {
        const stopCount = await claimRoute(id, courier.id, 'courier', courier.name);
        return NextResponse.json({ ok: true, data: { stopCount } });
      }
      case 'release': {
        const stopCount = await releaseRoute(id, courier.id);
        return NextResponse.json({ ok: true, data: { stopCount } });
      }
      case 'start': {
        const stopCount = await startRoute(id, courier.id);
        return NextResponse.json({ ok: true, data: { stopCount } });
      }
      default:
        return NextResponse.json({ ok: false, error: 'Aksi tidak dikenal' }, { status: 400 });
    }
  } catch (error) {
    console.error('[COURIER_ROUTE_ACTION]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Terjadi kesalahan server' }, { status: 500 });
  }
}