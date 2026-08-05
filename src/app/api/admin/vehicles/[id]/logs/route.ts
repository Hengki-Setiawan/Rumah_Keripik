import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vehicleLogs, vehicles, couriers } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const CreateLogSchema = z.object({
  logType: z.enum(['bbm', 'servis', 'ganti_oli', 'ban', 'pajak', 'insiden', 'lainnya']),
  costAmount: z.number().int().nonnegative().optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  note: z.string().max(1000).optional(),
  receiptPhotoUrl: z.string().url().optional().or(z.literal('')),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole('courier:manage');
    const { id } = await params;
    const vehicleId = Number(id);
    if (!Number.isInteger(vehicleId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!vehicle) return NextResponse.json({ ok: false, error: 'Kendaraan tidak ditemukan' }, { status: 404 });

    const logs = await db
      .select({
        id: vehicleLogs.id,
        vehicleId: vehicleLogs.vehicleId,
        logType: vehicleLogs.logType,
        costAmount: vehicleLogs.costAmount,
        odometerKm: vehicleLogs.odometerKm,
        note: vehicleLogs.note,
        receiptPhotoUrl: vehicleLogs.receiptPhotoUrl,
        loggedByCourierId: vehicleLogs.loggedByCourierId,
        courierName: couriers.name,
        loggedAt: vehicleLogs.loggedAt,
      })
      .from(vehicleLogs)
      .leftJoin(couriers, eq(vehicleLogs.loggedByCourierId, couriers.id))
      .where(eq(vehicleLogs.vehicleId, vehicleId))
      .orderBy(desc(vehicleLogs.loggedAt))
      .limit(100);

    const totalCost = logs.reduce((sum, l) => sum + (l.costAmount ?? 0), 0);

    return NextResponse.json({ ok: true, vehicle, logs, summary: { totalLogs: logs.length, totalCost } });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_VEHICLE_LOGS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole('courier:manage');
    const { id } = await params;
    const vehicleId = Number(id);
    if (!Number.isInteger(vehicleId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const body = CreateLogSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!vehicle) return NextResponse.json({ ok: false, error: 'Kendaraan tidak ditemukan' }, { status: 404 });

    await db.insert(vehicleLogs).values({
      vehicleId,
      logType: body.data.logType,
      costAmount: body.data.costAmount ?? null,
      odometerKm: body.data.odometerKm ?? null,
      note: body.data.note ?? null,
      receiptPhotoUrl: body.data.receiptPhotoUrl || null,
      loggedByCourierId: null,
    });

    if (body.data.odometerKm != null) {
      await db.update(vehicles).set({
        odometerKm: body.data.odometerKm,
        lastServiceAt: body.data.logType === 'servis' || body.data.logType === 'ganti_oli'
          ? new Date().toISOString()
          : undefined,
        updatedAt: new Date().toISOString(),
      }).where(eq(vehicles.id, vehicleId));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal catat log kendaraan' }, { status: 500 });
  }
}
