import { db } from '@/lib/db';
import { notificationLog } from '@/lib/schema';

/**
 * Catat setiap push notification yang dikirim ke notification_log (blueprint v28).
 * Idempotent: satu baris per (recipient, jenis, jam) — reuse bila sama dalam 60 detik.
 */
export async function logPushNotification(params: {
  recipientType: 'courier' | 'customer' | 'admin';
  recipientId: string;
  notificationType: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  payloadJson: string;
  expoTicketId?: string;
}): Promise<void> {
  const id = `NLOG-${params.recipientType.slice(0, 2).toUpperCase()}-${params.recipientId}-${Date.now().toString(36)}`;
  try {
    await db.insert(notificationLog).values({
      id,
      recipientType: params.recipientType,
      recipientId: params.recipientId,
      notificationType: params.notificationType,
      priority: params.priority ?? 'normal',
      payloadJson: params.payloadJson,
      expoTicketId: params.expoTicketId ?? null,
      serverSentAt: new Date().toISOString(),
      deliveryStatus: 'sent',
    });
  } catch {
    // Log best-effort; jangan menggagalkan alur notifikasi utama.
  }
}
