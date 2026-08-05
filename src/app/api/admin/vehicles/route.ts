import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vehicles, couriers, warehouses } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const CreateVehicleSchema = z.object({
  platNo: z.string().min(1, 'Plat nomor wajib diisi'),
  vehicleType: z.enum(['motor', 'mobil']),
  brandModel: z.string().optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  capacityKg: z.number().positive().optional(),
  capacityVolumeLiter: z.number().positive().optional(),
  status: z.enum(['active', 'maintenance', 'retired']).optional(),
  assignedCourierId: z.number().int().positive().optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  lastServiceAt: z.string().optional(),
  nextServiceDueKm: z.number().int().nonnegative().optional(),
  insuranceExpiresAt: z.string().optional(),
  stnkExpiresAt: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdminRole('courier:manage');
    const rows = await db
      .select({
        id: vehicles.id,
        platNo: vehicles.platNo,
        vehicleType: vehicles.vehicleType,
        brandModel: vehicles.brandModel,
        year: vehicles.year,
        capacityKg: vehicles.capacityKg,
        capacityVolumeLiter: vehicles.capacityVolumeLiter,
        status: vehicles.status,
        assignedCourierId: vehicles.assignedCourierId,
        courierName: couriers.name,
        odometerKm: vehicles.odometerKm,
        lastServiceAt: vehicles.lastServiceAt,
        nextServiceDueKm: vehicles.nextServiceDueKm,
        insuranceExpiresAt: vehicles.insuranceExpiresAt,
        stnkExpiresAt: vehicles.stnkExpiresAt,
        warehouseId: vehicles.warehouseId,
        warehouseName: warehouses.name,
        createdAt: vehicles.createdAt,
      })
      .from(vehicles)
      .leftJoin(couriers, eq(vehicles.assignedCourierId, couriers.id))
      .leftJoin(warehouses, eq(vehicles.warehouseId, warehouses.id))
      .orderBy(vehicles.id);

    const summary = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      maintenance: rows.filter((r) => r.status === 'maintenance').length,
      retired: rows.filter((r) => r.status === 'retired').length,
    };

    return NextResponse.json({ ok: true, vehicles: rows, summary });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_VEHICLES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('courier:manage');
    const body = CreateVehicleSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const [vehicle] = await db.insert(vehicles).values({
      platNo: body.data.platNo,
      vehicleType: body.data.vehicleType,
      brandModel: body.data.brandModel ?? null,
      year: body.data.year ?? null,
      capacityKg: body.data.capacityKg ?? null,
      capacityVolumeLiter: body.data.capacityVolumeLiter ?? null,
      status: body.data.status ?? 'active',
      assignedCourierId: body.data.assignedCourierId ?? null,
      odometerKm: body.data.odometerKm ?? null,
      lastServiceAt: body.data.lastServiceAt ?? null,
      nextServiceDueKm: body.data.nextServiceDueKm ?? null,
      insuranceExpiresAt: body.data.insuranceExpiresAt ?? null,
      stnkExpiresAt: body.data.stnkExpiresAt ?? null,
      updatedAt: new Date().toISOString(),
    }).returning({ id: vehicles.id, platNo: vehicles.platNo });

    return NextResponse.json({ ok: true, data: { id: vehicle?.id, platNo: vehicle?.platNo } });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    const msg = error instanceof Error ? error.message : 'Gagal tambah kendaraan';
    const isUnique = String(msg).toLowerCase().includes('unique');
    return NextResponse.json({ ok: false, error: isUnique ? 'Plat nomor sudah terdaftar' : msg }, { status: isUnique ? 409 : 500 });
  }
}
