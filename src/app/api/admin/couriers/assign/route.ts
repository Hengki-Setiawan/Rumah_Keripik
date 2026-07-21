import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, deliveryAssignment, transaksi } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { sendCourierPushNotification, sendOrderPushNotification } from '@/lib/expo-push';
import { z } from 'zod';

const AssignSchema = z.object({
  id_transaksi: z.string().min(1),
  kurir_id: z.number(),
});

export async function POST(request: Request) {
  try {
    await requireAdminRole('order:update');

    const body = await request.json();
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.id, parsed.data.kurir_id), eq(couriers.is_active, 1)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Kurir tidak ditemukan atau tidak aktif' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const [tx] = await db
      .select({ kode_pesanan: transaksi.kode_pesanan })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, parsed.data.id_transaksi))
      .limit(1);

    const [assignment] = await db
      .insert(deliveryAssignment)
      .values({
        id_transaksi: parsed.data.id_transaksi,
        kurir_id: parsed.data.kurir_id,
        kurir_name: existing.name,
        status: 'Siap_Dikirim',
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: deliveryAssignment.id_transaksi,
        set: { kurir_id: parsed.data.kurir_id, kurir_name: existing.name, status: 'Siap_Dikirim', updated_at: now },
      })
      .returning();

    await db
      .update(transaksi)
      .set({ order_status: 'shipping', updated_at: now })
      .where(eq(transaksi.id_transaksi, parsed.data.id_transaksi));

    const kode = tx?.kode_pesanan || 'pesanan';
    await sendCourierPushNotification(
      parsed.data.kurir_id,
      '📦 Pengiriman Baru',
      `Ada kiriman ${kode} untuk Anda. Segera ambil di gudang.`,
      { type: 'new_delivery', id_transaksi: parsed.data.id_transaksi }
    );

    await sendOrderPushNotification(parsed.data.id_transaksi, 'shipping');

    return NextResponse.json({ ok: true, assignment: { id: assignment.id, status: assignment.status } });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COURIER_ASSIGN]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
