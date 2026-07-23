import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { couriers, courierSessions } from '@/lib/schema';

export async function bindDeviceToCourier(courierId: number, deviceId: string) {
  const existing = await db.select().from(couriers).where(eq(couriers.id, courierId)).limit(1);
  if (existing.length === 0) throw new Error('Kurir tidak ditemukan');

  if (existing[0].device_id && existing[0].device_id !== deviceId) {
    await db.update(courierSessions).set({ is_active: false }).where(and(
      eq(courierSessions.courierId, courierId),
      eq(courierSessions.is_active, true),
    ));
  }

  await db.update(couriers).set({ device_id: deviceId }).where(eq(couriers.id, courierId));
  return { deviceBound: true };
}

export async function verifyDeviceBinding(courierId: number, deviceId: string): Promise<boolean> {
  const courier = await db.select({ device_id: couriers.device_id }).from(couriers).where(eq(couriers.id, courierId)).limit(1);
  if (courier.length === 0) return false;
  if (!courier[0].device_id) return true;
  return courier[0].device_id === deviceId;
}

export async function unbindDevice(courierId: number) {
  await db.update(couriers).set({ device_id: null }).where(eq(couriers.id, courierId));
  await db.update(courierSessions).set({ is_active: false }).where(and(
    eq(courierSessions.courierId, courierId),
    eq(courierSessions.is_active, true),
  ));
  return { deviceUnbound: true };
}
