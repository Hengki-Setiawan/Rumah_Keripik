import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderEvents, produk, transaksi, webOrderSession, customerProfile, deliveryAssignment, couriers } from '@/lib/schema';
import { normalizePhoneNumber } from '@/lib/utils';
import { checkRateLimit, getClientIp, isRateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function maskPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return value;
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

export async function GET(req: Request) {
  const clientIp = getClientIp(req);

  // Hardening: Block brute force attempts
  const isBlocked = await isRateLimited(`order-track-failures:${clientIp}`, 5);
  if (isBlocked) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak kegagalan pelacakan. Akses diblokir sementara selama 5 menit.' }, { status: 429 });
  }

  const rate = await checkRateLimit(`order-track:${clientIp}`, 30, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan cek status. Coba lagi sebentar.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  let code = searchParams.get('code')?.trim();
  const token = searchParams.get('token')?.trim();
  const phone = searchParams.get('phone')?.trim();

  const tokenCookie = (await cookies()).get('rk_order_session')?.value;
  let recentOrders: Array<{ kode_pesanan: string; total_bayar: number; waktu_simpan: string; order_status: string }> = [];

  if (tokenCookie) {
    const [session] = await db
      .select({ id_session: webOrderSession.id_session })
      .from(webOrderSession)
      .where(eq(webOrderSession.anonymous_token, tokenCookie))
      .limit(1);

    if (session) {
      // Ambil daftar semua pesanan dalam sesi ini
      const orders = await db
        .select({
          kode_pesanan: transaksi.kode_pesanan,
          total_bayar: transaksi.total_bayar,
          waktu_simpan: transaksi.waktu_simpan,
          order_status: transaksi.order_status,
        })
        .from(transaksi)
        .where(eq(transaksi.id_session, session.id_session))
        .orderBy(desc(transaksi.waktu_simpan))
        .limit(5);

      recentOrders = orders.filter((o): o is typeof o & { kode_pesanan: string } => o.kode_pesanan !== null);

      // Jika kode pesanan tidak dicantumkan di query params, gunakan pesanan terakhir dari sesi ini
      if (!code && recentOrders.length > 0) {
        code = recentOrders[0].kode_pesanan;
      }
    }
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: 'Kode pesanan wajib diisi atau buat pesanan terlebih dahulu.' }, { status: 400 });
  }

  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, code))
    .limit(1);

  if (!order) {
    await checkRateLimit(`order-track-failures:${clientIp}`, 5, 300_000);
    return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }

  // Verifikasi hanya dijalankan jika user secara eksplisit memberikan phone atau token
  if (phone || token) {
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    const tokenMatches = Boolean(order.status_token && token && token === order.status_token);
    const phoneMatches = Boolean(
      normalizedPhone &&
      [order.no_hp_penerima, order.no_wa_pelanggan]
        .filter(Boolean)
        .map((value) => normalizePhoneNumber(value as string))
        .includes(normalizedPhone)
    );

    if (!tokenMatches && !phoneMatches) {
      await checkRateLimit(`order-track-failures:${clientIp}`, 5, 300_000);
      return NextResponse.json({ ok: false, error: 'Verifikasi pesanan tidak valid' }, { status: 403 });
    }
  }

  // Ambil data customer (pemesan)
  let customer: { nama: string | null; phone: string | null } | null = null;
  if (order.id_customer) {
    const [cust] = await db
      .select({
        nama: customerProfile.nama,
        phone: customerProfile.phone,
      })
      .from(customerProfile)
      .where(eq(customerProfile.id_customer, order.id_customer))
      .limit(1);
    if (cust) {
      customer = {
        nama: cust.nama,
        phone: maskPhone(cust.phone),
      };
    }
  }

  const items = await db
    .select({
      id_produk: detailTransaksi.id_produk,
      nama_produk: produk.nama_produk,
      qty: detailTransaksi.qty_terjual,
      harga: detailTransaksi.harga_snapshot,
      subtotal: detailTransaksi.subtotal,
    })
    .from(detailTransaksi)
    .leftJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
    .where(eq(detailTransaksi.id_transaksi, order.id_transaksi));

  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.id_transaksi, order.id_transaksi));

  // Ambil data kurir (jika pesanan sudah ditugaskan)
  let courier: { name: string; vehicle: string | null; plat_no: string | null; last_lat: number | null; last_lng: number | null; last_location_at: string | null } | null = null;
  const [assignment] = await db
    .select()
    .from(deliveryAssignment)
    .where(eq(deliveryAssignment.id_transaksi, order.id_transaksi))
    .limit(1);

  if (assignment?.kurir_id) {
    const [kurir] = await db
      .select({
        name: couriers.name,
        vehicle: couriers.vehicle,
        plat_no: couriers.plat_no,
        last_lat: couriers.last_lat,
        last_lng: couriers.last_lng,
        last_location_at: couriers.last_location_at,
      })
      .from(couriers)
      .where(eq(couriers.id, assignment.kurir_id))
      .limit(1);

    if (kurir) {
      courier = kurir;
    }
  }

  return NextResponse.json({
    ok: true,
    order: {
      id_transaksi: order.id_transaksi,
      kode_pesanan: order.kode_pesanan,
      total_bayar: order.total_bayar,
      status_pembayaran: order.status_pembayaran,
      order_status: order.order_status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      nama_penerima: order.nama_penerima,
      no_hp_penerima: maskPhone(order.no_hp_penerima),
      alamat_penerima: order.alamat_penerima,
      waktu_simpan: order.waktu_simpan,
      updated_at: order.updated_at,
      status_token: order.status_token, // Diperlukan untuk upload bukti pembayaran
    },
    customer,
    items,
    events,
    recentOrders,
    courier: courier ? {
      name: courier.name,
      vehicle: courier.vehicle,
      plat_no: courier.plat_no,
      lat: courier.last_lat,
      lng: courier.last_lng,
      last_location_at: courier.last_location_at,
    } : null,
    delivery_status: assignment?.status || null,
  });
}
