import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCourierAuth } from '@/lib/courier-auth';
import { adminAuditLog, sosEvents, sosIncidents, couriers } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { location, timestamp, metadata } = await req.json().catch(() => ({})) as {
      location?: { lat?: number; lng?: number } | null;
      timestamp?: string;
      metadata?: { reason?: string } | null;
    };
    const lat = location?.lat != null ? String(location.lat) : null;
    const lng = location?.lng != null ? String(location.lng) : null;
    const reason = metadata?.reason || 'Emergency SOS';
    const now = new Date().toISOString();

    const [courierRow] = await db
      .select({ name: couriers.name, phone: couriers.phone })
      .from(couriers)
      .where(eq(couriers.id, courier.id))
      .limit(1);

    await db.insert(sosEvents).values({
      courierId: courier.id,
      courierName: courierRow?.name || null,
      courierPhone: courierRow?.phone || null,
      type: 'sos',
      severity: 'emergency',
      lat: lat || '0',
      lng: lng || '0',
      message: reason,
      status: 'active',
      createdAt: timestamp || now,
    });

    await db.insert(sosIncidents).values({
      courierId: courier.id,
      lat,
      lng,
      type: 'sos',
      severity: 'emergency',
      message: reason,
      status: 'open',
      triggeredAt: timestamp || now,
    });

    await db.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      action: 'courier_sos',
      actor: String(courier.id),
      resourceType: 'courier_sos',
      resourceId: String(courier.id),
      metadataJson: JSON.stringify({ location, timestamp, reason }),
      createdAt: timestamp || now,
    });

    return NextResponse.json({ ok: true, message: 'SOS signal received. Admin has been notified.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
  }
}
