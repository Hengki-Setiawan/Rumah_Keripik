import { db } from '@/lib/db';
import { warehouses, geofenceZones } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export interface GeofenceCheck {
  warehouseId: number | null;
  warehouseName: string | null;
  inside: boolean;
  distanceMeters: number;
  radiusMeters: number | null;
  zoneId: number | null;
  zoneName: string | null;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Periksa apakah koordinat berada dalam radius absensi (geofence) dari gudang.
 * Mengambil zona `attendance_radius` aktif dari tabel geofence_zones; fallback
 * ke semua warehouse aktif dengan radius default bila tidak ada zona terdaftar.
 */
export async function checkAttendanceGeofence(
  lat: number,
  lng: number
): Promise<GeofenceCheck> {
  const zone = await db
    .select({
      id: geofenceZones.id,
      name: geofenceZones.name,
      centerLat: geofenceZones.centerLat,
      centerLng: geofenceZones.centerLng,
      radiusMeters: geofenceZones.radiusMeters,
      warehouseId: geofenceZones.warehouseId,
      warehouseName: warehouses.name,
    })
    .from(geofenceZones)
    .leftJoin(warehouses, eq(geofenceZones.warehouseId, warehouses.id))
    .where(and(
      eq(geofenceZones.zoneType, 'attendance_radius'),
      eq(geofenceZones.isActive, 1),
    ))
    .limit(1);

  if (zone.length > 0) {
    const z = zone[0];
    const distanceMeters = haversineMeters(lat, lng, Number(z.centerLat), Number(z.centerLng));
    return {
      warehouseId: z.warehouseId,
      warehouseName: z.warehouseName ?? null,
      inside: distanceMeters <= z.radiusMeters,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters: z.radiusMeters,
      zoneId: z.id,
      zoneName: z.name,
    };
  }

  const wh = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.isActive, 1))
    .limit(1);

  if (wh.length > 0) {
    const w = wh[0];
    const distanceMeters = haversineMeters(lat, lng, Number(w.lat), Number(w.lng));
    const radius = Number(process.env.COURIER_GEOFENCE_RADIUS_KM || '20') * 1000;
    return {
      warehouseId: w.id,
      warehouseName: w.name,
      inside: distanceMeters <= radius,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters: radius,
      zoneId: null,
      zoneName: null,
    };
  }

  return {
    warehouseId: null,
    warehouseName: null,
    inside: true,
    distanceMeters: 0,
    radiusMeters: null,
    zoneId: null,
    zoneName: null,
  };
}

export { haversineMeters };
