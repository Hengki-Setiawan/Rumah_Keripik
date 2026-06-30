/**
 * chatbot-tools.ts — Tool Registry untuk Chatbot Rumah Keripik
 *
 * Berisi definisi semua "tool" yang bisa dipanggil oleh LLM (Groq tool calling)
 * maupun dipanggil secara langsung oleh state machine.
 *
 * Blueprint ref: BLUEPRINT_CHATBOT_SUPER_AI_RUMAH_KERIPIK.md §11
 */

import { db } from '@/lib/db';
import { produk, transaksi, detailTransaksi, memoryPelanggan, waitlistProduk } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { generateIdTransaksi, generateKodePesanan } from '@/lib/id-generator';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProdukInfo {
  id_produk: string;
  nama_produk: string;
  harga_jual: number;
  stok_gudang_utama: number;
  deskripsi?: string | null;
}

export interface CartItem {
  id_produk: string;
  nama_produk: string;
  varian?: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

// ─── TOOL: CEK KATALOG ───────────────────────────────────────────────────────

/**
 * Ambil daftar semua produk aktif untuk ditampilkan ke pelanggan.
 * Produk dengan stok 0 tetap ditampilkan tapi ditandai 'habis'.
 */
export async function toolGetKatalog(): Promise<ToolResult<ProdukInfo[]>> {
  try {
    const rows = await db
      .select({
        id_produk: produk.id_produk,
        nama_produk: produk.nama_produk,
        harga_jual: produk.harga_jual,
        stok_gudang_utama: produk.stok_gudang_utama,
        deskripsi: produk.deskripsi,
      })
      .from(produk)
      .where(eq(produk.is_active, 1));

    return { success: true, data: rows };
  } catch (err) {
    console.error('[Tool:GetKatalog]', err);
    return { success: false, error: 'Gagal mengambil katalog produk' };
  }
}

// ─── TOOL: CEK STOK ──────────────────────────────────────────────────────────

/**
 * Cek stok produk tertentu.
 * Mengembalikan stok saat ini dan apakah cukup untuk qty yang diminta.
 */
export async function toolCekStok(
  id_produk: string,
  qty_diminta: number = 1,
): Promise<ToolResult<{ stok: number; cukup: boolean; nama_produk: string }>> {
  try {
    const rows = await db
      .select({
        nama_produk: produk.nama_produk,
        stok: produk.stok_gudang_utama,
      })
      .from(produk)
      .where(and(eq(produk.id_produk, id_produk), eq(produk.is_active, 1)))
      .limit(1);

    if (!rows.length) {
      return { success: false, error: `Produk ${id_produk} tidak ditemukan` };
    }

    const { nama_produk, stok } = rows[0];
    return {
      success: true,
      data: { stok, cukup: stok >= qty_diminta, nama_produk },
    };
  } catch (err) {
    console.error('[Tool:CekStok]', err);
    return { success: false, error: 'Gagal mengecek stok' };
  }
}

// ─── TOOL: CARI PRODUK ───────────────────────────────────────────────────────

/**
 * Cari produk berdasarkan nama (fuzzy — menggunakan LIKE).
 */
export async function toolCariProduk(
  keyword: string,
): Promise<ToolResult<ProdukInfo[]>> {
  try {
    const rows = await db
      .select({
        id_produk: produk.id_produk,
        nama_produk: produk.nama_produk,
        harga_jual: produk.harga_jual,
        stok_gudang_utama: produk.stok_gudang_utama,
        deskripsi: produk.deskripsi,
      })
      .from(produk)
      .where(eq(produk.is_active, 1));

    // Filter client-side (Turso SQLite via libsql tidak support LIKE easily w/ drizzle)
    const lower = keyword.toLowerCase();
    const filtered = rows.filter(
      (r) =>
        r.nama_produk.toLowerCase().includes(lower) ||
        (r.deskripsi?.toLowerCase().includes(lower) ?? false),
    );

    return { success: true, data: filtered };
  } catch (err) {
    console.error('[Tool:CariProduk]', err);
    return { success: false, error: 'Gagal mencari produk' };
  }
}

// ─── TOOL: INSERT ORDER DRAFT ─────────────────────────────────────────────────

/**
 * Simpan order sebagai transaksi draft (status = Menunggu_Bayar).
 * Dipanggil setelah pelanggan konfirmasi rekap order.
 */
export async function toolInsertOrderDraft(params: {
  no_wa_pelanggan: string;
  cart: CartItem[];
  nama_penerima: string;
  alamat_penerima: string;
  no_hp_penerima?: string;
  catatan?: string;
  lat_pengiriman?: number;
  lng_pengiriman?: number;
}): Promise<ToolResult<{ id_transaksi: string; kode_pesanan: string; total_bayar: number }>> {
  try {
    const id_transaksi = await generateIdTransaksi();
    const kode_pesanan = generateKodePesanan();
    const total_bayar = params.cart.reduce((sum, item) => sum + item.subtotal, 0);

    // Insert transaksi
    await db.insert(transaksi).values({
      id_transaksi,
      no_wa_pelanggan: params.no_wa_pelanggan,
      tipe_penjualan: 'Online_WA',
      total_bayar,
      status_pembayaran: 'Menunggu_Bayar',
      kode_pesanan,
      nama_penerima: params.nama_penerima,
      alamat_penerima: params.alamat_penerima,
      no_hp_penerima: params.no_hp_penerima,
      catatan: params.catatan,
      sumber_order: 'WA',
      lat_pengiriman: params.lat_pengiriman?.toString(),
      lng_pengiriman: params.lng_pengiriman?.toString(),
    });

    // Insert detail transaksi
    for (const item of params.cart) {
      await db.insert(detailTransaksi).values({
        id_transaksi,
        id_produk: item.id_produk,
        qty_terjual: item.qty,
        harga_snapshot: item.harga_satuan,
        subtotal: item.subtotal,
      });
    }

    return {
      success: true,
      data: { id_transaksi, kode_pesanan, total_bayar },
    };
  } catch (err) {
    console.error('[Tool:InsertOrderDraft]', err);
    return { success: false, error: 'Gagal menyimpan draft pesanan' };
  }
}

// ─── TOOL: DAFTAR WAITLIST ───────────────────────────────────────────────────

/**
 * Daftarkan pelanggan ke waitlist notifikasi stok produk.
 */
export async function toolDaftarWaitlist(
  no_wa_pelanggan: string,
  id_produk: string,
  channel: 'wa' | 'telegram' = 'wa',
): Promise<ToolResult<{ terdaftar: boolean }>> {
  try {
    await db
      .insert(waitlistProduk)
      .values({ no_wa_pelanggan, id_produk, channel })
      .onConflictDoNothing();

    return { success: true, data: { terdaftar: true } };
  } catch (err) {
    console.error('[Tool:DaftarWaitlist]', err);
    return { success: false, error: 'Gagal mendaftar waitlist' };
  }
}

// ─── TOOL: GET MEMORY PELANGGAN ──────────────────────────────────────────────

/**
 * Ambil memory/profil pelanggan dari DB.
 */
export async function toolGetMemoryPelanggan(no_wa: string): Promise<ToolResult<{
  produk_favorit: string[];
  alamat_tersimpan: { label: string; alamat: string }[];
  total_order: number;
  avg_rating: number;
  last_order_date?: string | null;
}>> {
  try {
    const rows = await db
      .select()
      .from(memoryPelanggan)
      .where(eq(memoryPelanggan.no_wa_pelanggan, no_wa))
      .limit(1);

    if (!rows.length) {
      return {
        success: true,
        data: {
          produk_favorit: [],
          alamat_tersimpan: [],
          total_order: 0,
          avg_rating: 0,
        },
      };
    }

    const mem = rows[0];
    return {
      success: true,
      data: {
        produk_favorit: JSON.parse(mem.produk_favorit || '[]'),
        alamat_tersimpan: JSON.parse(mem.alamat_tersimpan || '[]'),
        total_order: mem.total_order || 0,
        avg_rating: (mem.avg_rating || 0) / 10,
        last_order_date: mem.last_order_date,
      },
    };
  } catch (err) {
    console.error('[Tool:GetMemory]', err);
    return { success: false, error: 'Gagal mengambil memory pelanggan' };
  }
}

// ─── TOOL DEFINITIONS (untuk Groq Tool Calling) ───────────────────────────────

/**
 * Definisi tool dalam format yang compatible dengan Groq/OpenAI tool calling.
 * Gunakan ini saat memanggil LLM dengan tool calling enabled.
 */
export const CHATBOT_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_katalog',
      description: 'Ambil daftar semua produk keripik yang tersedia beserta harga dan stok terkini',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cek_stok',
      description: 'Cek stok produk tertentu. Gunakan untuk verifikasi sebelum konfirmasi order.',
      parameters: {
        type: 'object',
        properties: {
          id_produk: { type: 'string', description: 'ID produk (contoh: KRP-001)' },
          qty_diminta: { type: 'number', description: 'Jumlah yang ingin dipesan' },
        },
        required: ['id_produk'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'cari_produk',
      description: 'Cari produk berdasarkan kata kunci nama. Gunakan untuk membantu pelanggan menemukan produk.',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Kata kunci pencarian (contoh: "singkong", "pedas")' },
        },
        required: ['keyword'],
      },
    },
  },
] as const;

/**
 * Eksekusi tool berdasarkan nama yang dipanggil oleh LLM.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case 'get_katalog':
      return toolGetKatalog();
    case 'cek_stok':
      return toolCekStok(args.id_produk as string, args.qty_diminta as number);
    case 'cari_produk':
      return toolCariProduk(args.keyword as string);
    default:
      return { success: false, error: `Tool "${toolName}" tidak dikenal` };
  }
}
