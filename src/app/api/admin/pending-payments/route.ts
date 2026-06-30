import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, detailTransaksi, produk, pelangganChatbot } from '@/lib/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        no_wa_pelanggan: transaksi.no_wa_pelanggan,
        nama_penerima: transaksi.nama_penerima,
        alamat_penerima: transaksi.alamat_penerima,
        lat_pengiriman: transaksi.lat_pengiriman,
        lng_pengiriman: transaksi.lng_pengiriman,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        bukti_transfer_url: transaksi.bukti_transfer_url,
        waktu_simpan: transaksi.waktu_simpan,
        sumber_order: transaksi.sumber_order,
        nama_pelanggan: pelangganChatbot.nama_pelanggan,
      })
      .from(transaksi)
      .leftJoin(pelangganChatbot, eq(transaksi.no_wa_pelanggan, pelangganChatbot.no_wa_pelanggan))
      .where(
        and(
          eq(transaksi.status_pembayaran, 'Menunggu_Verifikasi'),
          sql`${transaksi.bukti_transfer_url} IS NOT NULL`,
        ),
      )
      .orderBy(desc(transaksi.waktu_simpan));

    const pesanan = await Promise.all(
      rows.map(async (row) => {
        const items = await db
          .select({
            nama: produk.nama_produk,
            qty: detailTransaksi.qty_terjual,
            subtotal: detailTransaksi.subtotal,
          })
          .from(detailTransaksi)
          .innerJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
          .where(eq(detailTransaksi.id_transaksi, row.id_transaksi));

        return {
          id_transaksi: row.id_transaksi,
          kode_pesanan: row.kode_pesanan,
          no_wa_pelanggan: row.no_wa_pelanggan,
          nama_penerima: row.nama_penerima,
          alamat_penerima: row.alamat_penerima,
          lat_pengiriman: row.lat_pengiriman ? parseFloat(row.lat_pengiriman) : null,
          lng_pengiriman: row.lng_pengiriman ? parseFloat(row.lng_pengiriman) : null,
          total_bayar: row.total_bayar,
          bukti_url: row.bukti_transfer_url,
          waktu_simpan: row.waktu_simpan,
          channel: row.sumber_order?.toLowerCase() === 'wa' ? 'wa' : 'wa',
          nama_pelanggan: row.nama_pelanggan || row.nama_penerima || 'Tidak diketahui',
          items,
        };
      }),
    );

    return NextResponse.json({ pesanan, total: pesanan.length });
  } catch (err) {
    console.error('[PendingPayments] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
