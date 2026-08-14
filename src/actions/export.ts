'use server';

import { db } from '@/lib/db';
import { transaksi, produk, pelangganChatbot, chatLog } from '@/lib/schema';
import { desc, sql } from 'drizzle-orm';

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportTransaksiCSV() {
  try {
    const rows = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        no_wa_pelanggan: transaksi.no_wa_pelanggan,
        tipe_penjualan: transaksi.tipe_penjualan,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        catatan: transaksi.catatan,
        waktu_simpan: transaksi.waktu_simpan,
      })
      .from(transaksi)
      .orderBy(desc(transaksi.waktu_simpan))
      .limit(1000);

    const header = 'ID Transaksi,Kode Pesanan,No WA,Tipe,Total,Status,Catatan,Waktu';
    const lines = rows.map(r =>
      [r.id_transaksi, r.kode_pesanan, r.no_wa_pelanggan, r.tipe_penjualan, r.total_bayar, r.status_pembayaran, csvEscape(r.catatan), r.waktu_simpan].join(',')
    );

    return { success: true, data: [header, ...lines].join('\n'), filename: `transaksi_${new Date().toISOString().slice(0, 10)}.csv` };
  } catch {
    return { success: false, message: 'Gagal export transaksi' };
  }
}

export async function exportProdukCSV() {
  try {
    const rows = await db
      .select()
      .from(produk)
      .orderBy(desc(produk.updated_at));

    const header = 'ID Produk,Nama,Deskripsi,Harga,Stok,Status';
    const lines = rows.map(r =>
      [r.id_produk, csvEscape(r.nama_produk), csvEscape(r.deskripsi || ''), r.harga_jual, r.stok_gudang_utama, r.is_active ? 'Aktif' : 'Nonaktif'].join(',')
    );

    return { success: true, data: [header, ...lines].join('\n'), filename: `produk_${new Date().toISOString().slice(0, 10)}.csv` };
  } catch {
    return { success: false, message: 'Gagal export produk' };
  }
}

export async function exportPelangganCSV() {
  try {
    const rows = await db
      .select()
      .from(pelangganChatbot)
      .orderBy(desc(pelangganChatbot.terakhir_aktif));

    const header = 'No WA,Nama,Alamat,Status Handle,Tags,Terakhir Aktif,Waktu Daftar';
    const lines = rows.map(r =>
      [r.no_wa_pelanggan, csvEscape(r.nama_pelanggan || ''), csvEscape(r.alamat_pengiriman || ''), r.status_handle, csvEscape(r.tags || '[]'), r.terakhir_aktif, r.waktu_daftar].join(',')
    );

    return { success: true, data: [header, ...lines].join('\n'), filename: `pelanggan_${new Date().toISOString().slice(0, 10)}.csv` };
  } catch {
    return { success: false, message: 'Gagal export pelanggan' };
  }
}

// â”€â”€â”€ ANALITIK CHAT LOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getChatLogAnalytics() {
  try {
    const totals = await db
      .select({
        total: sql<number>`COUNT(*)`,
        rule: sql<number>`SUM(CASE WHEN sumber = 'rule' THEN 1 ELSE 0 END)`,
        groq: sql<number>`SUM(CASE WHEN sumber = 'groq' THEN 1 ELSE 0 END)`,
        gemini: sql<number>`SUM(CASE WHEN sumber = 'gemini' THEN 1 ELSE 0 END)`,
        notFound: sql<number>`SUM(CASE WHEN sumber = 'not_found' THEN 1 ELSE 0 END)`,
        totalTokens: sql<number>`COALESCE(SUM(tokens_used), 0)`,
      })
      .from(chatLog);

    // top 10 most frequent user questions
    const topQuestions = await db
      .select({
        user_message: chatLog.user_message,
        count: sql<number>`COUNT(*)`,
      })
      .from(chatLog)
      .groupBy(chatLog.user_message)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    return { success: true, data: { ...totals[0], topQuestions } };
  } catch {
    return { success: false, message: 'Gagal ambil analitik chat' };
  }
}
