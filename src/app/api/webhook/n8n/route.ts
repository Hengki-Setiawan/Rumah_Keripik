import { NextRequest, NextResponse } from 'next/server';
import { getAllProdukAktif } from '@/actions/produk';
import { getAllWarungAktif } from '@/actions/warung';
import { getAnalitikKPI, getRankingProduk } from '@/actions/transaksi';
import { db } from '@/lib/db';
import { pelangganChatbot, pesanChat, transaksi, detailTransaksi, produk } from '@/lib/schema';
import { eq, or, and, sql, desc } from 'drizzle-orm';
import { generateIdTransaksi } from '@/lib/id-generator';

/**
 * Webhook endpoint untuk n8n
 * Menerima event dari n8n dan melakukan operasi database
 * Authorization: header x-webhook-secret harus match dengan N8N_WEBHOOK_SECRET
 */

// Verifikasi webhook secret
function verifyWebhookSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-webhook-secret');
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

  return secret === expectedSecret && !!expectedSecret;
}

/**
 * POST webhook handler
 */
export async function POST(req: NextRequest) {
  // Verifikasi secret
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { event, payload } = body;

    // Router event
    switch (event) {
      case 'GET_KATALOG':
        return handleGetKatalog(payload);

      case 'GET_OR_CREATE_PELANGGAN':
        return handleGetOrCreatePelanggan(payload);

      case 'UPDATE_CONTEXT_SESI':
        return handleUpdatePelangganContext(payload);

      case 'GET_ANALITIK_KPI':
        return handleGetAnalitikKPI(payload);

      case 'GET_RANKING_PRODUK':
        return handleGetRankingProduk(payload);

      case 'LOG_PESAN_KELUAR':
        return handleLogPesanKeluar(payload);

      case 'GET_PESAN_KELUAR_HISTORY':
        return handleGetPesanKeluarHistory(payload);

      case 'INSERT_TRANSAKSI':
        return handleInsertTransaksi(payload);

      case 'UPDATE_PROFIL_PELANGGAN':
        return handleUpdateProfilPelanggan(payload);

      case 'SET_MANUAL_ADMIN':
        return handleSetManualAdmin(payload);

      default:
        return NextResponse.json(
          { success: false, error: `Event tidak dikenali: ${event}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET_KATALOG: Ambil semua produk aktif
 */
async function handleGetKatalog(payload: any) {
  const produk = await getAllProdukAktif();

  return NextResponse.json({
    success: true,
    data: {
      produk: produk.map((p) => ({
        id: p.id_produk,
        nama: p.nama_produk,
        harga: p.harga_jual,
        stok: p.stok_gudang_utama,
        deskripsi: p.deskripsi,
      })),
      total: produk.length,
    },
  });
}

/**
 * GET_OR_CREATE_PELANGGAN: Ambil data pelanggan atau buat baru
 */
async function handleGetOrCreatePelanggan(payload: any) {
  const { no_wa } = payload;

  if (!no_wa) {
    return NextResponse.json(
      { success: false, error: 'no_wa wajib diisi' },
      { status: 400 }
    );
  }

  try {
    // Cari pelanggan
    const existing = await db
      .select()
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          pelanggan: existing[0],
          isNew: false,
        },
      });
    }

    // Buat baru
    await db.insert(pelangganChatbot).values({
      no_wa_pelanggan: no_wa,
      status_handle: 'AI_Bot',
      context_sesi: JSON.stringify({}),
    });

    const created = await db
      .select()
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    return NextResponse.json({
      success: true,
      data: {
        pelanggan: created[0],
        isNew: true,
      },
    });
  } catch (error) {
    console.error('Error get/create pelanggan:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal get/create pelanggan' },
      { status: 500 }
    );
  }
}

/**
 * UPDATE_PELANGGAN_CONTEXT: Update context_sesi pelanggan
 */
async function handleUpdatePelangganContext(payload: any) {
  const { no_wa, context } = payload;

  if (!no_wa) {
    return NextResponse.json(
      { success: false, error: 'no_wa wajib diisi' },
      { status: 400 }
    );
  }

  try {
    await db
      .update(pelangganChatbot)
      .set({
        context_sesi: JSON.stringify(context || {}),
      })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    return NextResponse.json({
      success: true,
      message: 'Context pelanggan berhasil diupdate',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal update context' },
      { status: 500 }
    );
  }
}

/**
 * GET_ANALITIK_KPI: Ambil KPI dashboard
 */
async function handleGetAnalitikKPI(payload: any) {
  const kpi = await getAnalitikKPI();

  return NextResponse.json({
    success: true,
    data: kpi,
  });
}

/**
 * GET_RANKING_PRODUK: Ambil ranking produk terlaris
 */
async function handleGetRankingProduk(payload: any) {
  const { limit = 10 } = payload;
  const ranking = await getRankingProduk(limit);

  return NextResponse.json({
    success: true,
    data: ranking,
  });
}

/**
 * LOG_PESAN_KELUAR: Catat pesan keluar (dari bot/admin)
 * Diintegrasikan dengan PESAN_CHAT di Turso
 */
async function handleLogPesanKeluar(payload: any) {
  const { no_wa, teks, sumber = 'bot', id_external } = payload;

  if (!no_wa || !teks) {
    return NextResponse.json(
      { success: false, error: 'no_wa dan teks wajib diisi' },
      { status: 400 }
    );
  }

  try {
    await db.insert(pesanChat).values({
      no_wa_pelanggan: no_wa,
      direction: 'out',
      sumber: sumber as 'bot' | 'admin' | 'sistem',
      teks,
      id_external,
      status_kirim: 'sent',
    });

    return NextResponse.json({
      success: true,
      message: 'Pesan berhasil dicatat',
    });
  } catch (error) {
    console.error('Error log pesan:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal log pesan' },
      { status: 500 }
    );
  }
}

/**
 * GET_PESAN_KELUAR_HISTORY: Ambil riwayat pesan keluar
 */
async function handleGetPesanKeluarHistory(payload: any) {
  const { no_wa, limit = 50 } = payload;

  if (!no_wa) {
    return NextResponse.json(
      { success: false, error: 'no_wa wajib diisi' },
      { status: 400 }
    );
  }

  try {
    const messages = await db
      .select()
      .from(pesanChat)
      .where(eq(pesanChat.no_wa_pelanggan, no_wa))
      .orderBy(desc(pesanChat.timestamp))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: messages.reverse(), // Balik urutan agar ascending
    });
  } catch (error) {
    console.error('Error fetch pesan history:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal fetch riwayat pesan' },
      { status: 500 }
    );
  }
}

/**
 * INSERT_TRANSAKSI: Catat transaksi baru dari n8n
 * - Atomic transaction dengan TOCTOU validation
 * - Auto-retry jika UNIQUE constraint violation (kode_pesanan)
 */
async function handleInsertTransaksi(payload: any) {
  const { no_wa, id_warung, tipe_penjualan = 'Online_WA', items, catatan } = payload;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'items wajib diisi (array minimal 1)' },
      { status: 400 }
    );
  }

  if (!no_wa && !id_warung) {
    return NextResponse.json(
      { success: false, error: 'Minimal no_wa atau id_warung harus diisi' },
      { status: 400 }
    );
  }

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // TOCTOU fix: lock-read stok dalam transaction
      let totalBayar = 0;
      const detailsToInsert: { id_produk: string; qty_terjual: number; harga_snapshot: number; subtotal: number }[] = [];

      for (const item of items) {
        const { id_produk, qty_terjual } = item;

        const [prod] = await db
          .select()
          .from(produk)
          .where(eq(produk.id_produk, id_produk));

        if (!prod) {
          return NextResponse.json(
            { success: false, error: `Produk ${id_produk} tidak ditemukan` },
            { status: 400 }
          );
        }

        if (prod.stok_gudang_utama < qty_terjual) {
          return NextResponse.json(
            {
              success: false,
              error: `Stok ${prod.nama_produk} tidak cukup (tersedia: ${prod.stok_gudang_utama})`,
            },
            { status: 400 }
          );
        }

        const subtotal = prod.harga_jual * qty_terjual;
        totalBayar += subtotal;

        detailsToInsert.push({
          id_produk,
          qty_terjual,
          harga_snapshot: prod.harga_jual,
          subtotal,
        });
      }

      const id_transaksi = await generateIdTransaksi();

      // Atomic: insert transaksi + detail + update stok
      await db.transaction(async (tx) => {
        await tx.insert(transaksi).values({
          id_transaksi,
          no_wa_pelanggan: no_wa || null,
          id_warung: id_warung || null,
          tipe_penjualan: tipe_penjualan as 'Online_WA' | 'Offline_Gudang',
          total_bayar: totalBayar,
          status_pembayaran: 'Lunas',
          catatan: catatan || null,
        });

        for (const detail of detailsToInsert) {
          await tx.insert(detailTransaksi).values({
            id_transaksi,
            ...detail,
          });

          await tx
            .update(produk)
            .set({
              stok_gudang_utama: sql`stok_gudang_utama - ${detail.qty_terjual}`,
            })
            .where(eq(produk.id_produk, detail.id_produk));
        }
      });

      return NextResponse.json({
        success: true,
        data: { id_transaksi, total_bayar: totalBayar },
      });
    } catch (error: any) {
      const isUniqueViolation = error?.message?.includes('UNIQUE constraint');
      if (isUniqueViolation && attempt < MAX_RETRIES) {
        continue;
      }
      console.error('❌ INSERT_TRANSAKSI error:', error);
      return NextResponse.json(
        { success: false, error: `Gagal insert transaksi: ${error?.message || 'Unknown'}` },
        { status: 500 }
      );
    }
  }
}

/**
 * UPDATE_PROFIL_PELANGGAN: Update nama dan alamat pengiriman pelanggan
 */
async function handleUpdateProfilPelanggan(payload: any) {
  const { no_wa, nama_pelanggan, alamat_pengiriman } = payload;

  if (!no_wa) {
    return NextResponse.json(
      { success: false, error: 'no_wa wajib diisi' },
      { status: 400 }
    );
  }

  try {
    const updateData: Record<string, string> = {};
    if (nama_pelanggan) updateData.nama_pelanggan = nama_pelanggan;
    if (alamat_pengiriman) updateData.alamat_pengiriman = alamat_pengiriman;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data yang diupdate' },
        { status: 400 }
      );
    }

    await db
      .update(pelangganChatbot)
      .set(updateData)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    return NextResponse.json({
      success: true,
      message: 'Profil pelanggan berhasil diupdate',
    });
  } catch (error) {
    console.error('❌ UPDATE_PROFIL_PELANGGAN error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal update profil pelanggan' },
      { status: 500 }
    );
  }
}

/**
 * SET_MANUAL_ADMIN: Ubah status_handle pelanggan ke Manual_Admin
 */
async function handleSetManualAdmin(payload: any) {
  const { no_wa } = payload;

  if (!no_wa) {
    return NextResponse.json(
      { success: false, error: 'no_wa wajib diisi' },
      { status: 400 }
    );
  }

  try {
    await db
      .update(pelangganChatbot)
      .set({ status_handle: 'Manual_Admin' })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    return NextResponse.json({
      success: true,
      message: 'Status handle berhasil diubah ke Manual_Admin',
    });
  } catch (error) {
    console.error('❌ SET_MANUAL_ADMIN error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal set manual admin' },
      { status: 500 }
    );
  }
}

/**
 * GET method untuk health check
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Webhook n8n siap menerima event',
    timestamp: new Date().toISOString(),
  });
}
