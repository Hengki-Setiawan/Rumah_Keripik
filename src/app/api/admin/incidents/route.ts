import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sosIncidents, couriers } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';
import { getAdminActor } from '@/lib/admin-actor';
import { sendCourierPushNotification } from '@/lib/expo-push';

const UpdateSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['open', 'acknowledged', 'resolved', 'false_alarm']),
  resolutionNote: z.string().max(1000).optional(),
});

export async function GET() {
  try {
    await requireAdminRole('sos:view');
    const rows = await db
      .select({
        id: sosIncidents.id,
        courierId: sosIncidents.courierId,
        courierName: couriers.name,
        courierPhone: couriers.phone,
        deliveryAssignmentId: sosIncidents.deliveryAssignmentId,
        lat: sosIncidents.lat,
        lng: sosIncidents.lng,
        type: sosIncidents.type,
        severity: sosIncidents.severity,
        message: sosIncidents.message,
        status: sosIncidents.status,
        acknowledgedBy: sosIncidents.acknowledgedBy,
        acknowledgedAt: sosIncidents.acknowledgedAt,
        resolvedBy: sosIncidents.resolvedBy,
        resolvedAt: sosIncidents.resolvedAt,
        resolutionNote: sosIncidents.resolutionNote,
        triggeredAt: sosIncidents.triggeredAt,
      })
      .from(sosIncidents)
      .leftJoin(couriers, eq(sosIncidents.courierId, couriers.id))
      .orderBy(desc(sosIncidents.triggeredAt))
      .limit(100);

    const summary = {
      total: rows.length,
      open: rows.filter((r) => r.status === 'open').length,
      acknowledged: rows.filter((r) => r.status === 'acknowledged').length,
      resolved: rows.filter((r) => r.status === 'resolved').length,
      falseAlarm: rows.filter((r) => r.status === 'false_alarm').length,
    };

    return NextResponse.json({ ok: true, incidents: rows, summary });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_SOS_INCIDENTS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await getAdminActor();
    await requireAdminRole('sos:respond');
    const body = UpdateSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const id = body.data.id;
    const [existing] = await db.select().from(sosIncidents).where(eq(sosIncidents.id, id)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: 'Insiden tidak ditemukan' }, { status: 404 });

    const now = new Date().toISOString();
    await db.update(sosIncidents).set({
      status: body.data.status,
      acknowledgedBy: body.data.status === 'acknowledged' ? actor : existing.acknowledgedBy,
      acknowledgedAt: body.data.status === 'acknowledged' ? now : existing.acknowledgedAt,
      resolvedBy: body.data.status === 'resolved' || body.data.status === 'false_alarm' ? actor : existing.resolvedBy,
      resolvedAt: body.data.status === 'resolved' || body.data.status === 'false_alarm' ? now : existing.resolvedAt,
      resolutionNote: body.data.resolutionNote ?? existing.resolutionNote,
    }).where(eq(sosIncidents.id, id));

    if (body.data.status === 'resolved' || body.data.status === 'false_alarm') {
      await sendCourierPushNotification(
        existing.courierId,
        body.data.status === 'resolved' ? '✅ SOS Terselesaikan' : 'ℹ️ SOS Ditandai Tidak Valid',
        body.data.resolutionNote || 'Admin telah menutup laporan SOS Anda.',
        { type: 'sos_resolved' }
      ).catch(() => {});
    } else if (body.data.status === 'acknowledged') {
      await sendCourierPushNotification(
        existing.courierId,
        '📢 SOS Direspon Admin',
        'Admin telah melihat laporan Anda dan segera bertindak. Tetap aman.',
        { type: 'sos_acknowledged' }
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update insiden' }, { status: 500 });
  }
}
