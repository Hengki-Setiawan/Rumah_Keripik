'use server';

import { db } from '@/lib/db';
import { pelangganChatbot, transaksi, detailTransaksi, produk, pesanChat } from '@/lib/schema';
import { eq, desc, like, or, sql, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const revalidatePelanggan = () => {
  revalidatePath('/master-data/pelanggan');
  revalidatePath('/analitik');
};

export async function getAllPelanggan(page: number = 1, limit: number = 50) {
  try {
    const offset = (page - 1) * limit;
    return await db
      .select()
      .from(pelangganChatbot)
      .orderBy(desc(pelangganChatbot.terakhir_aktif))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error fetch pelanggan:', error);
    return [];
  }
}

export async function searchPelanggan(search: string) {
  try {
    return await db
      .select()
      .from(pelangganChatbot)
      .where(
        or(
          like(pelangganChatbot.nama_pelanggan, `%${search}%`),
          like(pelangganChatbot.no_wa_pelanggan, `%${search}%`),
        )
      )
      .orderBy(desc(pelangganChatbot.terakhir_aktif))
      .limit(50);
  } catch (error) {
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
  } catch (error) {
    return { success: false, message: 'Gagal update pelanggan' };
  }
}

export async function hapusPelanggan(no_wa: string) {
  try {
    const related = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(eq(transaksi.no_wa_pelanggan, no_wa));

    if (related[0].count > 0) {
      return {
        success: false,
        message: `Pelanggan tidak bisa dihapus karena memiliki ${related[0].count} riwayat transaksi`,
      };
    }

    await db.delete(pelangganChatbot).where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));
    return { success: true, message: 'Pelanggan berhasil dihapus' };
  } catch (error) {
    return { success: false, message: 'Gagal hapus pelanggan' };
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
  } catch (error) {
    return { total: 0, aiBot: 0, manual: 0 };
  }
}

// ─── TAGS ─────────────────────────────────────────────────────────────────────

export async function updateTags(no_wa: string, tags: string[]) {
  try {
    await db
      .update(pelangganChatbot)
      .set({ tags: JSON.stringify(tags) })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));
    revalidatePelanggan();
    return { success: true, message: 'Tags berhasil diupdate' };
  } catch (error) {
    return { success: false, message: 'Gagal update tags' };
  }
}

const TAG_OPTIONS = ['VIP', 'Prospek', 'Komplain', 'Pelanggan Baru', 'Butuh Follow-up', 'Tidak Aktif', 'Reseller', 'Dropshipper'];

export async function getTagOptions() {
  return TAG_OPTIONS;
}

// ─── TRANSAKSI PER PELANGGAN ──────────────────────────────────────────────────

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

// ─── CHAT HISTORY PER PELANGGAN ───────────────────────────────────────────────

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

// ─── COLLISION DETECTION ──────────────────────────────────────────────────────

export async function ambilAlihChatWithCheck(no_wa: string, adminName: string) {
  try {
    const pelanggan = await db
      .select()
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa))
      .limit(1)
      .then(r => r[0]);

    if (!pelanggan) return { success: false, message: 'Pelanggan tidak ditemukan' };

    if (pelanggan.diambil_oleh && pelanggan.diambil_oleh !== adminName && pelanggan.status_handle === 'Manual_Admin') {
      return {
        success: false,
        message: `Chat sedang dihandle oleh ${pelanggan.diambil_oleh}`,
        handledBy: pelanggan.diambil_oleh,
      };
    }

    await db
      .update(pelangganChatbot)
      .set({
        status_handle: 'Manual_Admin',
        diambil_oleh: adminName,
      })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    revalidatePath('/livechat');
    revalidatePath('/master-data/pelanggan');
    return { success: true, message: `Chat diambil alih oleh ${adminName}` };
  } catch (error) {
    return { success: false, message: 'Gagal ambil alih chat' };
  }
}

export async function lepasKeBot(no_wa: string) {
  try {
    await db
      .update(pelangganChatbot)
      .set({
        status_handle: 'AI_Bot',
        context_sesi: null,
        diambil_oleh: null,
      })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    revalidatePath('/livechat');
    revalidatePath('/master-data/pelanggan');
    return { success: true, message: 'Chat dikembalikan ke bot' };
  } catch (error) {
    return { success: false, message: 'Gagal lepas chat' };
  }
}

// ─── ORDER TRACKING ───────────────────────────────────────────────────────────

export async function getOrderStatus(kodePesanan: string) {
  try {
    const result = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        tipe_penjualan: transaksi.tipe_penjualan,
        waktu_simpan: transaksi.waktu_simpan,
        catatan: transaksi.catatan,
        nama_pelanggan: pelangganChatbot.nama_pelanggan,
        no_wa_pelanggan: pelangganChatbot.no_wa_pelanggan,
      })
      .from(transaksi)
      .leftJoin(pelangganChatbot, eq(transaksi.no_wa_pelanggan, pelangganChatbot.no_wa_pelanggan))
      .where(
        or(
          eq(transaksi.kode_pesanan, kodePesanan),
          eq(transaksi.id_transaksi, kodePesanan),
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const items = await db
      .select({
        nama_produk: produk.nama_produk,
        qty_terjual: detailTransaksi.qty_terjual,
        harga_snapshot: detailTransaksi.harga_snapshot,
        subtotal: detailTransaksi.subtotal,
      })
      .from(detailTransaksi)
      .innerJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
      .where(eq(detailTransaksi.id_transaksi, result[0].id_transaksi));

    return { ...result[0], items };
  } catch (error) {
    console.error('Error fetch order status:', error);
    return null;
  }
}
