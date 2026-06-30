import { NextRequest, NextResponse } from 'next/server';
import { parseEvolutionWebhook } from '@/lib/evolution-webhook';
import { sendTextMessage } from '@/lib/evolution';
import { processIncomingMessage } from '@/lib/chatbot-router';
import { resolvePublicBaseUrl } from '@/lib/public-url';

/**
 * Webhook Evolution API.
 * Set URL ini di dashboard/server Evolution sebagai webhook inbound.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const setup = searchParams.get('setup');

  if (setup === 'webhook') {
    const baseUrl = resolvePublicBaseUrl(`${req.nextUrl.protocol}//${req.nextUrl.host}`);
    const webhookUrl = `${baseUrl}/api/webhook/wa`;

    return NextResponse.json({
      ok: true,
      webhookUrl,
      message: 'Set webhook Evolution ke URL ini di server Evolution.',
    });
  }

  return NextResponse.json({
    ok: true,
    message: 'Webhook Evolution aktif. POST pesan masuk ke endpoint ini.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming = parseEvolutionWebhook(body);

    if (!incoming || !incoming.text) {
      return NextResponse.json({ success: true, ignored: true });
    }

    console.log(`WA dari ${incoming.from} (${incoming.name}): "${incoming.text}"`);

    // Simpan pesan masuk dari WhatsApp ke database agar muncul di Live Chat
    const { db } = await import('@/lib/db');
    const { pesanChat } = await import('@/lib/schema');
    try {
      await db.insert(pesanChat).values({
        no_wa_pelanggan: incoming.from,
        channel: 'wa',
        direction: 'in',
        sumber: 'pelanggan',
        teks: incoming.text,
        id_external: incoming.message_id || String(Date.now()),
        status_kirim: 'sent',
      });
    } catch (dbErr) {
      console.error('[WA Webhook] Gagal menyimpan pesan masuk ke db:', dbErr);
    }

    const result = await processIncomingMessage(incoming.from, incoming.text);

    if (result.response) {
      const sent = await sendTextMessage(incoming.from, result.response);
      if (!sent.success) {
        console.error('Gagal kirim reply Evolution:', sent.error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Evolution Webhook error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
