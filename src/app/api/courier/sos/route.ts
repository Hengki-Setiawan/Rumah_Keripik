import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCourierAuth } from '@/lib/courier-auth';
import { adminAuditLog } from '@/lib/schema';

export async function POST(req: NextRequest) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { location, timestamp } = await req.json();
    await db.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      action: 'courier_sos',
      actor: String(courier.id),
      resourceType: 'courier_sos',
      resourceId: String(courier.id),
      metadataJson: JSON.stringify({ location, timestamp }),
      createdAt: timestamp || new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, message: 'SOS signal received. Admin has been notified.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
  }
}
