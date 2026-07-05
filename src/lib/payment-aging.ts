import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderEvents, orderStatusHistory, transaksi } from '@/lib/schema';
import { safeJsonStringify } from '@/lib/json-utils';

const UNPAID_STATUSES = ['payment_instruction_shown', 'proof_uploaded', 'rejected'] as const;

export async function getPaymentAgingOrders() {
  const orders = await db
    .select({
      id_transaksi: transaksi.id_transaksi,
      kode_pesanan: transaksi.kode_pesanan,
      nama_penerima: transaksi.nama_penerima,
      no_hp_penerima: transaksi.no_hp_penerima,
      total_bayar: transaksi.total_bayar,
      payment_status: transaksi.payment_status,
      order_status: transaksi.order_status,
      waktu_simpan: transaksi.waktu_simpan,
    })
    .from(transaksi)
    .where(inArray(transaksi.payment_status, [...UNPAID_STATUSES]))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(100);

  return orders.map((order) => ({
    ...order,
    ageHours: getAgeHours(order.waktu_simpan),
    reminderDue: getAgeHours(order.waktu_simpan) >= 24,
  }));
}

export async function queuePaymentAgingReminders() {
  const orders = await db
    .select()
    .from(transaksi)
    .where(and(inArray(transaksi.payment_status, [...UNPAID_STATUSES]), sql`${transaksi.waktu_simpan} <= datetime('now', '-24 hours', 'utc')`))
    .limit(50);

  let queued = 0;
  for (const order of orders) {
    const [existing] = await db
      .select({ id: orderStatusHistory.id })
      .from(orderStatusHistory)
      .where(and(eq(orderStatusHistory.id_transaksi, order.id_transaksi), eq(orderStatusHistory.event_type, 'PAYMENT_REMINDER_DUE')))
      .limit(1);
    if (existing) continue;

    await db.transaction(async (tx) => {
      await tx.insert(orderStatusHistory).values({
        id_transaksi: order.id_transaksi,
        order_status: order.order_status,
        payment_status: order.payment_status,
        event_type: 'PAYMENT_REMINDER_DUE',
        actor: 'system',
        note: 'Reminder pembayaran 24 jam ditandai untuk tindak lanjut internal dashboard',
      });
      await tx.insert(orderEvents).values({
        id_transaksi: order.id_transaksi,
        no_wa_pelanggan: order.no_hp_penerima || order.no_wa_pelanggan || `web:${order.id_session || order.id_transaksi}`,
        event_type: 'WEB_PAYMENT_REMINDER_DUE',
        event_payload: safeJsonStringify({ ageHours: getAgeHours(order.waktu_simpan) }),
      });
    });
    queued += 1;
  }

  return { queued };
}

function getAgeHours(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.round((Date.now() - time) / 36_000) / 100);
}
