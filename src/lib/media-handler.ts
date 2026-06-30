import { db } from './db';
import { transaksi, buktiPembayaran } from './schema';
import { eq } from 'drizzle-orm';
import { sendTextMessage } from './evolution';
import type { OrderContext } from './order-types';
import fs from 'fs';
import path from 'path';

/**
 * Downloads media from Evolution API as base64
 */
async function downloadMediaFromEvolution(messageId: string): Promise<{
  base64: string;
  mimetype: string;
} | null> {
  const baseUrl = process.env.EVOLUTION_API_URL || 'https://wa.rumahkripik.com';
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME || 'rumah-kripik-bot';

  if (!apiKey) {
    console.error('[MediaHandler] EVOLUTION_API_KEY is not defined in environment');
    return null;
  }

  const url = `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId,
          },
        },
        convertToMp4: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    
    if (!res.ok) {
      console.error('[MediaHandler] Evolution download returned error status:', res.status, await res.text());
      return null;
    }
    
    const data = await res.json();
    if (!data.base64) {
      console.error('[MediaHandler] Base64 is missing in response:', data);
      return null;
    }
    
    return {
      base64: data.base64,
      mimetype: data.mimetype || 'image/jpeg',
    };
  } catch (err) {
    console.error('[MediaHandler] Failed to download base64 from Evolution API:', err);
    return null;
  }
}

/**
 * Saves base64 string to a file under /public/uploads/bukti/
 */
async function saveBase64ToFile(
  base64: string,
  id_transaksi: string,
  mimetype: string,
): Promise<string> {
  const ext = mimetype.includes('png') ? 'png' : 'jpg';
  const filename = `${id_transaksi}_${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'bukti');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const filepath = path.join(uploadDir, filename);
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filepath, buffer);
  
  return `/uploads/bukti/${filename}`;
}

/**
 * Main function: downloads image, saves to local folder, inserts db row, and updates transaction state
 */
export async function processPaymentProof(
  no_wa: string,
  messageId: string,
  ctx: OrderContext,
): Promise<{ response: string; source: 'rule'; newContext: OrderContext }> {
  
  if (!ctx.id_transaksi) {
    return {
      response: 'Maaf kak, tidak ada pesanan aktif yang ditemukan. Coba lakukan pemesanan ulang ya.',
      source: 'rule',
      newContext: { ...ctx, step: 'IDLE' },
    };
  }
  
  try {
    console.log(`[MediaHandler] Downloading proof of payment for transaction: ${ctx.id_transaksi}`);
    const media = await downloadMediaFromEvolution(messageId);
    
    if (!media) {
      return {
        response: 'Maaf kak, gambar tidak bisa diunduh oleh server chatbot 😅 Silakan kirim ulang foto bukti transfernya ya.',
        source: 'rule',
        newContext: ctx,
      };
    }
    
    // Save to filesystem
    const fileUrl = await saveBase64ToFile(media.base64, ctx.id_transaksi, media.mimetype);
    console.log(`[MediaHandler] Saved file to public path: ${fileUrl}`);

    // Insert to bukti_pembayaran table
    await db.insert(buktiPembayaran).values({
      id_transaksi: ctx.id_transaksi,
      no_wa_pelanggan: no_wa,
      url_gambar: fileUrl,
      mimetype: media.mimetype,
      status_verifikasi: 'Menunggu',
    });
    
    // Update transaksi status to Menunggu_Verifikasi and save the proof URL
    await db
      .update(transaksi)
      .set({ 
        status_pembayaran: 'Menunggu_Verifikasi',
        bukti_transfer_url: fileUrl,
      })
      .where(eq(transaksi.id_transaksi, ctx.id_transaksi));
    
    const newCtx: OrderContext = {
      ...ctx,
      step: 'BUKTI_DITERIMA',
      bukti_url: fileUrl,
      last_updated: new Date().toISOString(),
    };
    
    return {
      response: 
        `✅ *Bukti transfer Anda telah kami terima!*\n\n` +
        `Kode Pesanan: ${ctx.kode_pesanan || ctx.id_transaksi}\n` +
        `Status: *Menunggu Verifikasi Admin*\n\n` +
        `Kami akan memverifikasi pembayaran Anda dalam 5-15 menit. Anda akan menerima pesan notifikasi di sini setelah pembayaran disetujui. Terima kasih! 🙏`,
      source: 'rule',
      newContext: newCtx,
    };
  } catch (err) {
    console.error('[MediaHandler] Error parsing payment proof:', err);
    return {
      response: 'Maaf, terjadi kesalahan teknis saat memproses foto bukti pembayaran Anda. Silakan coba kirim ulang ya.',
      source: 'rule',
      newContext: ctx,
    };
  }
}
