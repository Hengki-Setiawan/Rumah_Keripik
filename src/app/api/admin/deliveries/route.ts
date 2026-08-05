import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi } from '@/lib/schema';
import { eq, isNull, desc, and } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('order:update');

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const courierId = url.searchParams.get('courierId');
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 200);

    const conditions = [];

    if (status && status !== 'Semua') {
      const st = status.toLowerCase();
      if (st === 'belum_ditugaskan' || st === 'unassigned') {
        conditions.push(isNull(deliveryAssignment.id));
      } else if (st === 'siap_dikirim') {
        conditions.push(eq(deliveryAssignment.status, 'Siap_Dikirim'));
      } else if (st === 'dalam_pengiriman') {
        conditions.push(eq(deliveryAssignment.status, 'Dalam_Pengiriman'));
      } else if (st === 'terkirim') {
        conditions.push(eq(deliveryAssignment.status, 'Terkirim'));
      } else if (st === 'gagal') {
        conditions.push(eq(deliveryAssignment.status, 'Gagal'));
      }
    }

    if (courierId) conditions.push(eq(deliveryAssignment.kurir_id, parseInt(courierId)));

    const rows = await db
      .select({
        id: deliveryAssignment.id,
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        nama_penerima: transaksi.nama_penerima,
        alamat_penerima: transaksi.alamat_penerima,
        no_hp_penerima: transaksi.no_hp_penerima,
        order_status: transaksi.order_status,
        kurir_id: deliveryAssignment.kurir_id,
        kurir_name: deliveryAssignment.kurir_name,
        status: deliveryAssignment.status,
        pickup_at: deliveryAssignment.pickup_at,
        delivered_at: deliveryAssignment.delivered_at,
        created_at: deliveryAssignment.created_at,
        updated_at: deliveryAssignment.updated_at,
      })
      .from(transaksi)
      .leftJoin(deliveryAssignment, eq(transaksi.id_transaksi, deliveryAssignment.id_transaksi))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transaksi.waktu_simpan))
      .limit(limit);

    const deliveries = rows.map((r) => ({
      ...r,
      status: r.status ?? 'Belum_Ditugaskan',
      kurir_id: r.kurir_id ?? null,
      kurir_name: r.kurir_name ?? null,
    }));

    return NextResponse.json({ ok: true, deliveries });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_DELIVERIES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}