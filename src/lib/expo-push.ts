import { desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expoPushTokens, transaksi } from '@/lib/schema';
import type { ExpoPushToken } from '@/lib/schema';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushMessage = {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
};

type ExpoPushResponse = {
  data: Array<{
    id: string;
    status: 'ok' | 'error';
    message?: string;
    details?: { error?: string };
  }>;
  errors?: Array<{ message: string }>;
};

function buildOrderPushTitle(orderStatus: string | null): string {
  switch (orderStatus) {
    case 'processing': return 'Pesanan Diproses';
    case 'shipping': return 'Pesanan Dikirim';
    case 'completed': return 'Pesanan Selesai';
    case 'cancelled': return 'Pesanan Dibatalkan';
    default: return 'Update Pesanan';
  }
}

function buildOrderPushBody(orderStatus: string | null, kodePesanan?: string | null): string {
  const label = kodePesanan ? `#${kodePesanan}` : '';
  switch (orderStatus) {
    case 'processing': return `Pesanan ${label} sedang disiapkan.`;
    case 'shipping': return `Pesanan ${label} sudah dikirim.`;
    case 'completed': return `Pesanan ${label} sudah selesai. Terima kasih!`;
    case 'cancelled': return `Pesanan ${label} dibatalkan.`;
    default: return `Ada update untuk pesanan ${label}.`;
  }
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<ExpoPushResponse | null> {
  if (tokens.length === 0) return null;

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const result: ExpoPushResponse = await response.json();

    // Remove invalid tokens (e.g., unregistered devices)
    if (result.data) {
      const invalidTokens = result.data
        .filter((item) => item.status === 'error' && item.details?.error === 'DeviceNotRegistered')
        .map((_, i) => tokens[i])
        .filter(Boolean);

      if (invalidTokens.length > 0) {
        await db
          .delete(expoPushTokens)
          .where(inArray(expoPushTokens.token, invalidTokens));
      }
    }

    return result;
  } catch {
    return null;
  }
}

export async function sendOrderPushNotification(orderId: string, orderStatus: string | null) {
  const [order] = await db
    .select({ kode_pesanan: transaksi.kode_pesanan, id_customer: transaksi.id_customer, id_session: transaksi.id_session })
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, orderId))
    .limit(1);

  if (!order) return;

  const filters: ReturnType<typeof eq>[] = [];
  if (order.id_customer) filters.push(eq(expoPushTokens.customerId, order.id_customer));
  if (order.id_session) filters.push(eq(expoPushTokens.orderSessionId, order.id_session));

  if (filters.length === 0) return;

  const tokens = await db
    .select({ token: expoPushTokens.token })
    .from(expoPushTokens)
    .where(or(...filters))
    .orderBy(desc(expoPushTokens.lastActiveAt));

  if (tokens.length === 0) return;

  const title = buildOrderPushTitle(orderStatus);
  const body = buildOrderPushBody(orderStatus, order.kode_pesanan);

  await sendPushNotification(
    tokens.map((t) => t.token),
    title,
    body,
    { orderId, kodePesanan: order.kode_pesanan || '', orderStatus: orderStatus || '' }
  );
}
