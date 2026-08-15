import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, transaksi } from '@/lib/schema';
import { createChatMessage } from './messages';
import { sendOrderPushNotification } from '@/lib/expo-push';
import type { ChatComponent } from './types';

type OrderNotificationType =
  | 'payment_uploaded'
  | 'payment_verified'
  | 'payment_rejected'
  | 'order_processing'
  | 'order_shipping'
  | 'order_completed'
  | 'order_cancelled';

const templates: Record<OrderNotificationType, string> = {
  payment_uploaded: 'Pembayaran kakak sudah tercatat. Status akan diperbarui setelah verifikasi selesai ya kak.',
  payment_verified: 'Pembayaran kakak sudah berhasil diverifikasi. Pesanan sedang kami proses ya.',
  payment_rejected: 'Pembayaran belum berhasil diproses. Kalau perlu bantuan, buka status pesanan atau hubungi admin ya kak.',
  order_processing: 'Pesanan kakak sedang disiapkan.',
  order_shipping: 'Pesanan kakak sudah masuk proses pengiriman.',
  order_completed: 'Pesanan sudah selesai. Terima kasih sudah pesan di Rumah Keripik.',
  order_cancelled: 'Pesanan dibatalkan. Jika perlu bantuan, admin siap membantu ya.',
};

export async function notifyChatForOrderEvent(orderId: string, type: OrderNotificationType, options: { statusToken?: string; note?: string } = {}) {
  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, orderId)).limit(1);
  if (!order) return;

  const sessions = await db.select().from(chatSessions).where(eq(chatSessions.activeOrderId, orderId)).limit(10);
  if (sessions.length === 0) return;

  const components: ChatComponent[] = [
    {
      type: 'order_status_card',
      orderId,
      status: order.order_status,
      paymentStatus: order.payment_status,
    },
  ];

  if (type === 'payment_rejected') {
    components.push({
      type: 'quick_replies',
      options: [
        { id: 'rejected-track', label: 'Buka Pesanan Saya', value: '/pesan/saya', action: 'tool_action' },
        { id: 'rejected-admin', label: 'Hubungi admin', value: 'saya butuh bantuan admin', action: 'send_message' },
      ],
    });
  }

  const content = options.note ? `${templates[type]}\n${options.note}` : templates[type];
  await Promise.all([
    ...sessions.map((session) => createChatMessage({
      chatSessionId: session.id,
      role: 'system',
      content,
      components,
      metadata: { eventType: type, orderId },
    })),
    sendOrderPushNotification(orderId, order.order_status),
  ]);
}
