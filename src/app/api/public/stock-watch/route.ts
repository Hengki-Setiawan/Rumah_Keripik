import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { requireOwnedChatSession, chatOwnershipErrorResponse } from '@/lib/chat-v3/ownership';
import { subscribeStockWatch, cancelStockWatch, getStockStatus } from '@/lib/chat-v3/stock-watch';

const SubscribeSchema = z.object({
  chatSessionId: z.string().min(1),
  idProduk: z.string().min(1),
  idVarian: z.string().nullable().optional(),
});

const CancelSchema = z.object({
  chatSessionId: z.string().min(1),
  idProduk: z.string().min(1),
  idVarian: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(`stock-watch:${getClientIp(req)}`, 20, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, { status: 429 });

  const parsed = SubscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload tidak valid' }, { status: 400 });

  try {
    await requireOwnedChatSession(parsed.data.chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }

  const status = await getStockStatus(parsed.data.idProduk, parsed.data.idVarian ?? null);
  if (status.available) {
    return NextResponse.json({ ok: true, subscribed: false, alreadyAvailable: true });
  }

  const result = await subscribeStockWatch({
    chatSessionId: parsed.data.chatSessionId,
    idProduk: parsed.data.idProduk,
    idVarian: parsed.data.idVarian ?? null,
  });

  return NextResponse.json({ ok: true, subscribed: true, alreadyWatching: result.alreadyWatching });
}

export async function DELETE(req: Request) {
  const parsed = CancelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload tidak valid' }, { status: 400 });

  try {
    await requireOwnedChatSession(parsed.data.chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }

  await cancelStockWatch(parsed.data.chatSessionId, parsed.data.idProduk, parsed.data.idVarian ?? null);
  return NextResponse.json({ ok: true, cancelled: true });
}
