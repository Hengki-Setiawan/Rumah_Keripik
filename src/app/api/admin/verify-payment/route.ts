import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, detailTransaksi, produk, buktiPembayaran, pelangganChatbot } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { sendTextMessage } from '@/lib/evolution';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id_transaksi, action, catatan_admin } = body;

    if (!id_transaksi || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id_transaksi dan action (approve/reject) wajib diisi' }, { status: 400 });
    }

    const [tx] = await db
      .select()
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, id_transaksi))
      .limit(1);

    if (!tx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    if (action === 'approve') {
      await db.transaction(async (trx) => {
        await trx
          .update(transaksi)
          .set({
            status_pembayaran: 'Lunas',
            catatan: sql`CASE WHEN ${transaksi.catatan} IS NULL THEN 'Diverifikasi admin' ELSE ${transaksi.catatan} || ' | Diverifikasi admin' END`,
          })
          .where(eq(transaksi.id_transaksi, id_transaksi));

        await trx
          .update(buktiPembayaran)
          .set({
            status_verifikasi: 'Diterima',
            diverifikasi_oleh: body.admin_username || 'admin',
            catatan_admin: catatan_admin || null,
            waktu_verifikasi: sql`(datetime('now', 'utc'))`,
          })
          .where(eq(buktiPembayaran.id_transaksi, id_transaksi));

        const details = await trx
          .select()
          .from(detailTransaksi)
          .where(eq(detailTransaksi.id_transaksi, id_transaksi));

        for (const detail of details) {
          await trx
            .update(produk)
            .set({ stok_gudang_utama: sql`stok_gudang_utama - ${detail.qty_terjual}` })
            .where(eq(produk.id_produk, detail.id_produk));
        }

        // Set context ke SELESAI agar customer bisa kasih rating
        if (tx.no_wa_pelanggan) {
          await trx
            .update(pelangganChatbot)
            .set({ context_sesi: JSON.stringify({ step: 'SELESAI', id_transaksi, kode_pesanan: tx.kode_pesanan }) })
            .where(eq(pelangganChatbot.no_wa_pelanggan, tx.no_wa_pelanggan));
        }
      });

      // ─── GENERATE INVOICE PDF & UPLOAD TO CLOUDINARY ────────────────────────
      let invoiceUrl = '';
      try {
        const { generateAndSaveInvoice } = await import('@/lib/invoice-generator');
        invoiceUrl = await generateAndSaveInvoice(id_transaksi);
      } catch (invoiceErr) {
        console.error('[VerifyPayment] Gagal generate invoice:', invoiceErr);
      }
      // ────────────────────────────────────────────────────────────────────────

      if (tx.no_wa_pelanggan) {
        let msg =
          `🎉 *Pembayaran Terverifikasi!* 🎉\n\n` +
          `Halo kak! Pembayaran untuk pesanan *${tx.kode_pesanan || tx.id_transaksi}* sudah kami terima dan verifikasi ✅\n\n` +
          `Pesanan Kakak akan segera kami proses.\n` +
          `Estimasi pengiriman: 1-2 hari kerja 📦\n\n`;

        if (invoiceUrl) {
          msg += `📄 *Download Invoice PDF:* ${invoiceUrl}\n\n`;
        }

        msg += `Ketik *rating* 1-5 untuk penilaian pelayanan kami ya kak ⭐🙏`;

        sendTextMessage(tx.no_wa_pelanggan, msg).catch(console.warn);
      }

      return NextResponse.json({ success: true, status: 'Lunas', invoice_url: invoiceUrl });
    }

    if (action === 'reject') {
      await db.transaction(async (trx) => {
        await trx
          .update(transaksi)
          .set({
            status_pembayaran: 'Dibatalkan',
            catatan: sql`CASE WHEN ${transaksi.catatan} IS NULL THEN 'Pembayaran ditolak' ELSE ${transaksi.catatan} || ' | Pembayaran ditolak' END`,
          })
          .where(eq(transaksi.id_transaksi, id_transaksi));

        await trx
          .update(buktiPembayaran)
          .set({
            status_verifikasi: 'Ditolak',
            diverifikasi_oleh: body.admin_username || 'admin',
            catatan_admin: catatan_admin || 'Bukti tidak valid',
            waktu_verifikasi: sql`(datetime('now', 'utc'))`,
          })
          .where(eq(buktiPembayaran.id_transaksi, id_transaksi));

        const ctx = await trx
          .select({ context_sesi: pelangganChatbot.context_sesi })
          .from(pelangganChatbot)
          .where(eq(pelangganChatbot.no_wa_pelanggan, tx.no_wa_pelanggan ?? ''))
          .limit(1)
          .then((r) => r[0]);

        if (ctx) {
          await trx
            .update(pelangganChatbot)
            .set({ context_sesi: JSON.stringify({ step: 'IDLE' }) })
            .where(eq(pelangganChatbot.no_wa_pelanggan, tx.no_wa_pelanggan ?? ''));
        }
      });

      if (tx.no_wa_pelanggan) {
        const reason = catatan_admin || 'bukti transfer tidak valid atau tidak sesuai';
        const msg =
          `❌ *Pembayaran Ditolak*\n\n` +
          `Maaf kak, pembayaran untuk *${tx.kode_pesanan || tx.id_transaksi}* ditolak.\n` +
          `Alasan: ${reason}\n\n` +
          `Silakan kirim ulang bukti transfer yang valid ya kak 🙏`;

        sendTextMessage(tx.no_wa_pelanggan, msg).catch(console.warn);
      }

      return NextResponse.json({ success: true, status: 'Dibatalkan' });
    }

    return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 });
  } catch (err) {
    console.error('[VerifyPayment] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
