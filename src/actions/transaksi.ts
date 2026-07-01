'use server';

import { db } from '@/lib/db';
import { transaksi, detailTransaksi, produk, pelangganChatbot, warungRetail } from '@/lib/schema';
import { eq, and, desc, gte, lte, sql, count, sum } from 'drizzle-orm';
import { z } from 'zod';
import { generateIdTransaksi, generateKodePesanan } from '@/lib/id-generator';
import { normalizePhoneNumber } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

const DetailTransaksiSchema = z.object({
  id_produk: z.string().min(1),
  qty_terjual: z.number().int().min(1),
});

const TransaksiOfflineSchema = z.object({
  no_wa_pelanggan: z.string().optional(),
  id_warung: z.string().optional(),
  tipe_penjualan: z.enum(['Online_WA', 'Offline_Gudang']),
  status_pembayaran: z.enum(['Lunas', 'Piutang', 'Tidak_Lunas']),
  tanggal_jatuh_tempo: z.string().optional(),
  items: z.array(DetailTransaksiSchema).min(1, 'Minimal 1 item transaksi'),
  catatan: z.string().optional(),
});

type TransaksiOfflineInput = z.infer<typeof TransaksiOfflineSchema>;

/**
 * Catat penjualan offline gudang (admin input manual)
 * - Atomic transaction: TRANSAKSI + DETAIL_TRANSAKSI + update stok
 * - Validasi stok sebelum insert
 * - Snapshot harga dari produk terbaru (ANTI TOCTOU)
 */
export async function catatPenjualanOffline(data: TransaksiOfflineInput) {
  try {
    const validated = TransaksiOfflineSchema.parse(data);

    // Validasi: minimal no_wa_pelanggan atau id_warung
    if (!validated.no_wa_pelanggan && !validated.id_warung) {
      return {
        success: false,
        message: 'Minimal isi nomor WA pelanggan atau pilih warung',
      };
    }

    // Validasi: jika piutang, wajib isi tanggal jatuh tempo
    if (validated.status_pembayaran === 'Piutang' && !validated.tanggal_jatuh_tempo) {
      return {
        success: false,
        message: 'Tanggal jatuh tempo wajib diisi untuk piutang',
      };
    }

    // Fetch semua produk untuk validasi stok & snapshot harga
    const allProducts = await db.select().from(produk);
    const productMap = new Map(allProducts.map((p) => [p.id_produk, p]));

    // Validasi stok & hitung total
    let totalBayar = 0;
    const detailsToInsert: { id_produk: string; qty_terjual: number; harga_snapshot: number; subtotal: number }[] = [];

    for (const item of validated.items) {
      const prod = productMap.get(item.id_produk);
      if (!prod) {
        return {
          success: false,
          message: `Produk ${item.id_produk} tidak ditemukan`,
        };
      }

      if (prod.stok_gudang_utama < item.qty_terjual) {
        return {
          success: false,
          message: `Stok ${prod.nama_produk} tidak cukup (tersedia: ${prod.stok_gudang_utama}, diminta: ${item.qty_terjual})`,
        };
      }

      const subtotal = prod.harga_jual * item.qty_terjual;
      totalBayar += subtotal;

      detailsToInsert.push({
        id_produk: item.id_produk,
        qty_terjual: item.qty_terjual,
        harga_snapshot: prod.harga_jual, // SNAPSHOT dari DB, bukan payload
        subtotal,
      });
    }

    // Atomic transaction: INSERT transaksi + detail + update stok
    const id_transaksi = await generateIdTransaksi();
    const kode_pesanan = validated.tipe_penjualan === 'Online_WA' ? generateKodePesanan() : null;

    await db.transaction(async (tx) => {
      await tx.insert(transaksi).values({
        id_transaksi,
        no_wa_pelanggan: validated.no_wa_pelanggan,
        id_warung: validated.id_warung,
        tipe_penjualan: validated.tipe_penjualan,
        total_bayar: totalBayar,
        status_pembayaran: validated.status_pembayaran,
        tanggal_jatuh_tempo: validated.tanggal_jatuh_tempo,
        kode_pesanan,
        catatan: validated.catatan,
      });

      for (const detail of detailsToInsert) {
        await tx.insert(detailTransaksi).values({
          id_transaksi,
          ...detail,
        });

        const result = await tx
          .update(produk)
          .set({ stok_gudang_utama: sql`stok_gudang_utama - ${detail.qty_terjual}` })
          .where(
            and(
              eq(produk.id_produk, detail.id_produk),
              sql`stok_gudang_utama >= ${detail.qty_terjual}`
            )
          );

        if (result.rowsAffected === 0) {
          throw new Error(`Stok ${detail.id_produk} tidak cukup saat transaksi`);
        }
      }
    });

    revalidatePath('/master-data/transaksi-offline');
    revalidatePath('/analitik');

    return {
      success: true,
      message: `Transaksi ${id_transaksi} berhasil dicatat (${validated.status_pembayaran})`,
      id_transaksi,
      total_bayar: totalBayar,
    };
  } catch (error) {
    console.error('Error catat penjualan offline:', error);
    return {
      success: false,
      message: error instanceof z.ZodError ? error.errors[0].message : 'Gagal catat penjualan offline',
    };
  }
}

/**
 * Ambil daftar transaksi piutang yang belum lunas
 */
export async function getPiutangBelumLunas() {
  try {
    const result = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        no_wa_pelanggan: transaksi.no_wa_pelanggan,
        id_warung: transaksi.id_warung,
        nama_pelanggan: pelangganChatbot.nama_pelanggan,
        nama_warung: warungRetail.nama_warung,
        total_bayar: transaksi.total_bayar,
        tanggal_jatuh_tempo: transaksi.tanggal_jatuh_tempo,
        waktu_simpan: transaksi.waktu_simpan,
        status_pembayaran: transaksi.status_pembayaran,
      })
      .from(transaksi)
      .leftJoin(pelangganChatbot, eq(transaksi.no_wa_pelanggan, pelangganChatbot.no_wa_pelanggan))
      .leftJoin(warungRetail, eq(transaksi.id_warung, warungRetail.id_warung))
      .where(eq(transaksi.status_pembayaran, 'Piutang'));

    return result;
  } catch (error) {
    console.error('Error fetch piutang:', error);
    return [];
  }
}

/**
 * Tandai piutang sebagai LUNAS
 */
export async function tandaiPiutangLunas(id_transaksi: string) {
  try {
    await db
      .update(transaksi)
      .set({
        status_pembayaran: 'Lunas',
        tanggal_jatuh_tempo: null,
      })
      .where(eq(transaksi.id_transaksi, id_transaksi));

    revalidatePath('/master-data/transaksi-offline');
    revalidatePath('/analitik');

    return {
      success: true,
      message: 'Piutang berhasil ditandai lunas',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal tandai piutang lunas',
    };
  }
}

/**
 * Ambil omzet harian 7 hari terakhir
 */
export async function getOmzetHarian() {
  try {
    const result = await db
      .select({
        tanggal: sql<string>`DATE(${transaksi.waktu_simpan})`,
        omzet: sql<number>`CAST(SUM(${transaksi.total_bayar}) AS INTEGER)`,
        jumlah_transaksi: sql<number>`COUNT(*)`,
      })
      .from(transaksi)
      .where(
        gte(
          transaksi.waktu_simpan,
          sql`DATE('now', '-6 days', 'utc')`
        )
      )
      .groupBy(sql`DATE(${transaksi.waktu_simpan})`)
      .orderBy(sql`DATE(${transaksi.waktu_simpan})`);

    return result;
  } catch (error) {
    console.error('Error fetch omzet harian:', error);
    return [];
  }
}

/**
 * Ambil analytics: total omzet, transaksi, stok, pelanggan aktif
 * Dengan SQL aggregation — grouping by tipe_penjualan jika ada date range
 */
export async function getAnalitikKPI(startDate?: string, endDate?: string) {
  try {
    const conditions = [];
    if (startDate) conditions.push(gte(transaksi.waktu_simpan, startDate));
    if (endDate) conditions.push(lte(transaksi.waktu_simpan, endDate));

    const txFilter = conditions.length > 0 ? and(...conditions) : undefined;

    const [txResult] = await db
      .select({
        totalOmzet: sql<number>`CAST(COALESCE(SUM(${transaksi.total_bayar}), 0) AS INTEGER)`,
        totalTransaksi: sql<number>`COUNT(*)`,
      })
      .from(transaksi)
      .where(txFilter);

    const [stokResult] = await db
      .select({
        totalStok: sql<number>`CAST(COALESCE(SUM(${produk.stok_gudang_utama}), 0) AS INTEGER)`,
      })
      .from(produk);

    const [pelangganResult] = await db
      .select({
        totalPelanggan: sql<number>`COUNT(*)`,
      })
      .from(pelangganChatbot);

    return {
      totalOmzet: txResult?.totalOmzet ?? 0,
      totalTransaksi: txResult?.totalTransaksi ?? 0,
      totalStok: stokResult?.totalStok ?? 0,
      totalPelanggan: pelangganResult?.totalPelanggan ?? 0,
    };
  } catch (error) {
    console.error('Error fetch analitik KPI:', error);
    return { totalOmzet: 0, totalTransaksi: 0, totalStok: 0, totalPelanggan: 0 };
  }
}

/**
 * Ambil ranking produk terlaris via SQL JOIN
 */
export async function getRankingProduk(limit: number = 10) {
  try {
    const result = await db
      .select({
        id_produk: detailTransaksi.id_produk,
        nama_produk: produk.nama_produk,
        qty_total: sql<number>`CAST(SUM(${detailTransaksi.qty_terjual}) AS INTEGER)`,
        total_omzet: sql<number>`CAST(SUM(${detailTransaksi.subtotal}) AS INTEGER)`,
      })
      .from(detailTransaksi)
      .innerJoin(produk, eq(produk.id_produk, detailTransaksi.id_produk))
      .groupBy(detailTransaksi.id_produk)
      .orderBy(sql`SUM(${detailTransaksi.qty_terjual}) DESC`)
      .limit(limit);

    return result;
  } catch (error) {
    console.error('Error fetch ranking produk:', error);
    return [];
  }
}

/**
 * Ambil semua transaksi dengan pagination via SQL JOIN
 */
export async function getAllTransaksi(page: number = 1, limit: number = 20) {
  try {
    const offset = (page - 1) * limit;

    const [{ count: total }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi);

    const data = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        no_wa_pelanggan: transaksi.no_wa_pelanggan,
        id_warung: transaksi.id_warung,
        tipe_penjualan: transaksi.tipe_penjualan,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        tanggal_jatuh_tempo: transaksi.tanggal_jatuh_tempo,
        kode_pesanan: transaksi.kode_pesanan,
        catatan: transaksi.catatan,
        lat_pengiriman: transaksi.lat_pengiriman,
        lng_pengiriman: transaksi.lng_pengiriman,
        jarak_km_dari_gudang: transaksi.jarak_km_dari_gudang,
        invoice_url: transaksi.invoice_url,
        waktu_simpan: transaksi.waktu_simpan,
        nama_pelanggan: pelangganChatbot.nama_pelanggan,
        nama_warung: warungRetail.nama_warung,
      })
      .from(transaksi)
      .leftJoin(pelangganChatbot, eq(transaksi.no_wa_pelanggan, pelangganChatbot.no_wa_pelanggan))
      .leftJoin(warungRetail, eq(transaksi.id_warung, warungRetail.id_warung))
      .orderBy(desc(transaksi.waktu_simpan))
      .limit(limit)
      .offset(offset);

    return { data, total, page, limit };
  } catch (error) {
    console.error('Error fetch transaksi:', error);
    return { data: [], total: 0, page: 1, limit };
  }
}
