import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CreateChatOrderSchema } from '@/lib/chat-v3/schemas';
import { createOrderFromChatCart } from '@/lib/orders/create-chat-order';
import { createChatMessage, getChatMessages } from '@/lib/chat-v3/messages';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getChatCart } from '@/lib/ai/tools/cart';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rate = await checkRateLimit(`chat-order:${getClientIp(req)}`, 12, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan order. Coba lagi sebentar.' }, { status: 429 });

  const parsed = CreateChatOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Data order belum lengkap' }, { status: 400 });

  try {
    const result = await createOrderFromChatCart(parsed.data);
    const statusUrl = `/pesan/sukses/${encodeURIComponent(result.kodePesanan)}?token=${encodeURIComponent(result.statusToken)}`;
    await createChatMessage({
      chatSessionId: parsed.data.chatSessionId,
      role: 'system',
      content: result.paymentMethod === 'cod'
        ? 'Order COD berhasil dibuat. Admin akan mengecek dan mengonfirmasi pesanan kakak.'
        : result.checkoutUrl
          ? 'Order berhasil dibuat. Lanjutkan pembayaran online dulu ya kak, nanti status pesanan akan terupdate otomatis.'
          : 'Order berhasil dibuat. Link pembayaran online sedang disiapkan, cek status pesanan dulu ya kak.',
      components: [
        { type: 'order_status_card', orderId: result.idTransaksi, status: 'awaiting_payment', paymentStatus: result.statusPembayaran },
        ...(result.paymentMethod === 'cod'
          ? []
          : [{ type: 'payment_upload' as const, orderId: result.idTransaksi, statusToken: result.statusToken }]),
        {
          type: 'quick_replies',
          options: [
            ...(result.paymentMethod !== 'cod' && result.checkoutUrl
              ? [{ id: 'bayar-sekarang', label: 'Bayar sekarang', value: result.checkoutUrl, action: 'tool_action' as const }]
              : []),
            { id: 'lihat-status', label: 'Lihat status', value: statusUrl, action: 'tool_action' as const },
            { id: 'pesanan-saya', label: 'Pesanan saya', value: '/pesan/saya', action: 'tool_action' as const },
          ],
        },
      ],
      metadata: { order: result },
    });

    const response = NextResponse.json({ ok: true, order: result, statusUrl, messages: await getChatMessages(parsed.data.chatSessionId), cart: await getChatCart(parsed.data.chatSessionId) });
    (await cookies()).set('rk_order_session', result.anonymousToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && req.headers.get('x-forwarded-proto') === 'https',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal membuat order dari chat' }, { status: 400 });
  }
}
