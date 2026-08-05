import { db } from '@/lib/db';
import { deliveryEvents } from '@/lib/schema';

export type DeliveryEventType = 'assigned' | 'started' | 'arrived' | 'completed' | 'failed' | 'reassigned' | 'cancelled' | 'note_added';

/**
 * Tulis audit-trail `delivery_events` untuk satu delivery.
 * Tabel ini (courier v20) tidak diisi secara konsisten di semua aksi —
 * helper ini menjadi satu-satunya titik tulis agar lengkap di start/arrived/
 * complete/fail. Tidak melempar: audit trail tidak boleh menggagalkan aksi.
 */
export async function insertDeliveryEvent(input: {
  deliveryId: number;
  courierId: number | null;
  eventType: DeliveryEventType;
  lat?: string | null;
  lng?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(deliveryEvents).values({
      deliveryId: input.deliveryId,
      courierId: input.courierId,
      eventType: input.eventType,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
  } catch (error) {
    console.error('[insertDeliveryEvent]', error);
  }
}