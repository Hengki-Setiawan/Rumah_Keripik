import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, parseIncomingMessage, isStatusUpdate, sendTextMessage } from '@/lib/wa-cloud';
import { processIncomingMessage } from '@/lib/chatbot-router';

/**
 * GET — Verifikasi Webhook (dipanggil Meta saat setup)
 * Meta mengirim: hub.mode, hub.verify_token, hub.challenge
 * Harus mengembalikan challenge jika verify_token cocok
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const result = verifyWebhook(mode, token, challenge);

  if (result.verified) {
    return new NextResponse(result.challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verifikasi webhook gagal — token tidak cocok' }, { status: 403 });
}

/**
 * POST — Menerima notifikasi dari WhatsApp Cloud API
 * Bisa berupa: pesan baru, status update, atau pesan non-teks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Abaikan status updates (delivery/read receipts)
    if (isStatusUpdate(body)) {
      return NextResponse.json({ success: true });
    }

    // Parse pesan masuk — skip non-text messages
    const incoming = parseIncomingMessage(body);
    if (!incoming || !incoming.text) {
      return NextResponse.json({ success: true });
    }

    console.log(`WA dari ${incoming.from} (${incoming.name}): "${incoming.text}"`);

    // Proses via chatbot router
    const result = await processIncomingMessage(incoming.from, incoming.text);

    // Kirim balasan jika ada
    if (result.response) {
      const sent = await sendTextMessage(incoming.from, result.response);
      if (!sent.success) {
        console.error('Gagal kirim WA reply:', sent.error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WA Webhook error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
