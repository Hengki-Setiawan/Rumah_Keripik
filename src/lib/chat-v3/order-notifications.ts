import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, transaksi } from '@/lib/schema';
import { createChatMessage } from './messages';
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
  payment_uploaded: 'Bukti pembayaran kakak sudah diterima. Admin akan cek dan memperbarui status pesanan ya.',
  payment_verified: 'Pembayaran kakak sudah berhasil diverifikasi. Pesanan sedang kami proses ya.',
  payment_rejected: 'Bukti pembayaran belum bisa kami verifikasi. Mohon cek kembali atau kirim ulang bukti pembayaran ya.',
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
      deliveryStatus: order.order_status,
    },
  ];

  if (type === 'payment_rejected' && order.status_token) {
    components.push({ type: 'payment_upload', orderId, statusToken: order.status_token });
  }

  const content = options.note ? `${templates[type]}\n${options.note}` : templates[type];
  await Promise.all(
    sessions.map((session) => createChatMessage({
      chatSessionId: session.id,
      role: 'system',
      content,
      components,
      metadata: { eventType: type, orderId },
    }))
  );
}
