'use server';

import { db } from '@/lib/db';
import { pelangganChatbot, transaksi, pesanChat, lokasiPelanggan } from '@/lib/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const revalidatePelanggan = () => {
  revalidatePath('/master-data/pelanggan');
  revalidatePath('/analitik');
};

export async function getAllPelanggan(page: number = 1, limit: number = 50) {
  try {
    const offset = (page - 1) * limit;
    return await db
      .select({
        no_wa_pelanggan: pelangganChatbot.no_wa_pelanggan,
        nama_pelanggan: pelangganChatbot.nama_pelanggan,
        alamat_pengiriman: pelangganChatbot.alamat_pengiriman,
        channel: pelangganChatbot.channel,
        status_handle: pelangganChatbot.status_handle,
        context_sesi: pelangganChatbot.context_sesi,
        tags: pelangganChatbot.tags,
        diambil_oleh: pelangganChatbot.diambil_oleh,
        waktu_daftar: pelangganChatbot.waktu_daftar,
        terakhir_aktif: pelangganChatbot.terakhir_aktif,
        latest_lat: sql<string | null>`(
          SELECT ${lokasiPelanggan.lat}
          FROM ${lokasiPelanggan}
          WHERE ${lokasiPelanggan.no_wa_pelanggan} = ${pelangganChatbot.no_wa_pelanggan}
          ORDER BY ${lokasiPelanggan.timestamp} DESC
          LIMIT 1
        )`,
        latest_lng: sql<string | null>`(
          SELECT ${lokasiPelanggan.lng}
          FROM ${lokasiPelanggan}
          WHERE ${lokasiPelanggan.no_wa_pelanggan} = ${pelangganChatbot.no_wa_pelanggan}
          ORDER BY ${lokasiPelanggan.timestamp} DESC
          LIMIT 1
        )`,
        latest_location_source: sql<string | null>`(
          SELECT ${lokasiPelanggan.source}
          FROM ${lokasiPelanggan}
          WHERE ${lokasiPelanggan.no_wa_pelanggan} = ${pelangganChatbot.no_wa_pelanggan}
          ORDER BY ${lokasiPelanggan.timestamp} DESC
          LIMIT 1
        )`,
      })
      .from(pelangganChatbot)
      .orderBy(desc(pelangganChatbot.terakhir_aktif))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error fetch pelanggan:', error);
    return [];
  }
}

export async function getPelangganByNoWa(no_wa: string) {
  try {
    const result = await db
      .select()
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetch pelanggan by NoWA:', error);
    return null;
  }
}

export async function updatePelanggan(
  no_wa: string,
  data: { nama_pelanggan?: string; alamat_pengiriman?: string }
) {
  try {
    await db
      .update(pelangganChatbot)
      .set(data)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    revalidatePelanggan();
    return { success: true, message: 'Data pelanggan berhasil diupdate' };
  } catch {
    return { success: false, message: 'Gagal update pelanggan' };
  }
}

export async function getStatsPelanggan() {
  try {
    const [result] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        aiBot: sql<number>`SUM(CASE WHEN status_handle = 'AI_Bot' THEN 1 ELSE 0 END)`,
        manual: sql<number>`SUM(CASE WHEN status_handle = 'Manual_Admin' THEN 1 ELSE 0 END)`,
      })
      .from(pelangganChatbot);

    return {
      total: result?.total ?? 0,
      aiBot: result?.aiBot ?? 0,
      manual: result?.manual ?? 0,
    };
  } catch {
    return { total: 0, aiBot: 0, manual: 0 };
  }
}

// â”€â”€â”€ TAGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateTags(no_wa: string, tags: string[]) {
  try {
    await db
      .update(pelangganChatbot)
      .set({ tags: JSON.stringify(tags) })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));
    revalidatePelanggan();
    return { success: true, message: 'Tags berhasil diupdate' };
  } catch {
    return { success: false, message: 'Gagal update tags' };
  }
}

const TAG_OPTIONS = ['VIP', 'Prospek', 'Komplain', 'Pelanggan Baru', 'Butuh Follow-up', 'Tidak Aktif', 'Reseller', 'Dropshipper'];

export async function getTagOptions() {
  return TAG_OPTIONS;
}

// â”€â”€â”€ TRANSAKSI PER PELANGGAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getTransaksiByPelanggan(no_wa: string) {
  try {
    return await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        tipe_penjualan: transaksi.tipe_penjualan,
        kode_pesanan: transaksi.kode_pesanan,
        catatan: transaksi.catatan,
        waktu_simpan: transaksi.waktu_simpan,
        items: sql<string>`(
          SELECT GROUP_CONCAT(p.nama_produk || ' x' || dt.qty_terjual, ', ')
          FROM detail_transaksi dt
          JOIN produk p ON p.id_produk = dt.id_produk
          WHERE dt.id_transaksi = transaksi.id_transaksi
        )`,
      })
      .from(transaksi)
      .where(eq(transaksi.no_wa_pelanggan, no_wa))
      .orderBy(desc(transaksi.waktu_simpan))
      .limit(50);
  } catch (error) {
    console.error('Error fetch transaksi by pelanggan:', error);
    return [];
  }
}

// â”€â”€â”€ CHAT HISTORY PER PELANGGAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getChatHistoryByPelanggan(no_wa: string) {
  try {
    const outMsgs = await db
      .select({
        direction: pesanChat.direction,
        sumber: pesanChat.sumber,
        teks: pesanChat.teks,
        timestamp: pesanChat.timestamp,
      })
      .from(pesanChat)
      .where(eq(pesanChat.no_wa_pelanggan, no_wa))
      .orderBy(desc(pesanChat.timestamp))
      .limit(100);

    return outMsgs.reverse();
  } catch (error) {
    console.error('Error fetch chat history:', error);
    return [];
  }
}
