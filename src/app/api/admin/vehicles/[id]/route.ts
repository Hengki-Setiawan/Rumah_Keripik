import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vehicles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const UpdateVehicleSchema = z.object({
  brandModel: z.string().optional(),
  year: z.number().int().min(1990).max(2100).optional(),
  capacityKg: z.number().positive().optional(),
  capacityVolumeLiter: z.number().positive().optional(),
  status: z.enum(['active', 'maintenance', 'retired']).optional(),
  assignedCourierId: z.number().int().positive().nullable().optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  lastServiceAt: z.string().nullable().optional(),
  nextServiceDueKm: z.number().int().nonnegative().optional(),
  insuranceExpiresAt: z.string().nullable().optional(),
  stnkExpiresAt: z.string().nullable().optional(),
  warehouseId: z.number().int().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole('courier:manage');
    const { id } = await params;
    const vehicleId = Number(id);
    if (!Number.isInteger(vehicleId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const body = UpdateVehicleSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const [existing] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: 'Kendaraan tidak ditemukan' }, { status: 404 });

    await db.update(vehicles).set({
      brandModel: body.data.brandModel,
      year: body.data.year,
      capacityKg: body.data.capacityKg,
      capacityVolumeLiter: body.data.capacityVolumeLiter,
      status: body.data.status,
      assignedCourierId: body.data.assignedCourierId === undefined ? undefined : body.data.assignedCourierId,
      odometerKm: body.data.odometerKm,
      lastServiceAt: body.data.lastServiceAt === undefined ? undefined : body.data.lastServiceAt,
      nextServiceDueKm: body.data.nextServiceDueKm,
      insuranceExpiresAt: body.data.insuranceExpiresAt === undefined ? undefined : body.data.insuranceExpiresAt,
      stnkExpiresAt: body.data.stnkExpiresAt === undefined ? undefined : body.data.stnkExpiresAt,
      warehouseId: body.data.warehouseId,
      updatedAt: new Date().toISOString(),
    }).where(eq(vehicles.id, vehicleId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update kendaraan' }, { status: 500 });
  }
}
