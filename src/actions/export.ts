'use server';

import { db } from '@/lib/db';
import { transaksi, detailTransaksi, produk, pelangganChatbot, warungRetail, chatLog } from '@/lib/schema';
import { eq, desc, inArray, and, sql } from 'drizzle-orm';

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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    return { success: false, message: 'Gagal export pelanggan' };
  }
}

export async function exportWarungCSV() {
  try {
    const rows = await db
      .select()
      .from(warungRetail)
      .orderBy(desc(warungRetail.waktu_daftar));

    const header = 'ID Warung,Nama,Pemilik,No WA,Alamat,Tipe,Min Order,Status';
    const lines = rows.map(r =>
      [r.id_warung, csvEscape(r.nama_warung), csvEscape(r.pemilik || ''), csvEscape(r.no_wa_warung || ''), csvEscape(r.alamat), r.tipe_kemitraan, r.min_order_grosir, r.is_active ? 'Aktif' : 'Nonaktif'].join(',')
    );

    return { success: true, data: [header, ...lines].join('\n'), filename: `warung_${new Date().toISOString().slice(0, 10)}.csv` };
  } catch (error) {
    return { success: false, message: 'Gagal export warung' };
  }
}

// ─── ANALITIK CHAT LOG ────────────────────────────────────────────────────────

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
  } catch (error) {
    return { success: false, message: 'Gagal ambil analitik chat' };
  }
}

// ─── REKOMENDASI PRODUK ───────────────────────────────────────────────────────

export async function getProductRecommendations(idProduk: string) {
  try {
    // Cari transaksi yang mengandung produk ini
    const txIds = await db
      .select({ id_transaksi: detailTransaksi.id_transaksi })
      .from(detailTransaksi)
      .where(eq(detailTransaksi.id_produk, idProduk))
      .limit(50);

    if (txIds.length === 0) return [];

    const txIdList = txIds.map(t => t.id_transaksi);

    const recoms = await db
      .select({
        id_produk: detailTransaksi.id_produk,
        qty: sql<number>`SUM(${detailTransaksi.qty_terjual})`,
      })
      .from(detailTransaksi)
      .where(
        and(
          inArray(detailTransaksi.id_transaksi, txIdList),
          sql`${detailTransaksi.id_produk} != ${idProduk}`,
        )
      )
      .groupBy(detailTransaksi.id_produk)
      .orderBy(desc(sql`SUM(${detailTransaksi.qty_terjual})`))
      .limit(5);

    if (recoms.length === 0) return [];

    const produkList = await db
      .select()
      .from(produk)
      .where(inArray(produk.id_produk, recoms.map(r => r.id_produk)));

    return recoms.map(r => {
      const p = produkList.find(pr => pr.id_produk === r.id_produk);
      return p ? { ...p, co_occurrence: r.qty } : null;
    }).filter(Boolean);
  } catch (error) {
    console.error('getProductRecommendations error:', error);
    return [];
  }
}
