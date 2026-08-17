import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { createChatMessage, getChatMessages } from '@/lib/chat-v3/messages';
import { SendChatSchema } from '@/lib/chat-v3/schemas';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getChatCart } from '@/lib/ai/tools/cart';
import { buildChatResponse, buildPausedChatResponse } from '@/lib/ai/orchestrator';
import { rememberChatSignals } from '@/lib/chat-v3/memory';
import { updateContextSummary } from '@/lib/chat-v3/context-summary';
import { guardInput, BLOCKED_REPLY } from '@/lib/ai/prompt-guard';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';
import { updateChatSessionTitle } from '@/lib/chat-v3/session-title';
import { db } from '@/lib/db';
import { chatSessions } from '@/lib/schema';

export const runtime = 'nodejs';

// Anti-spam: hitung pesan berisiko/diblokir berulang per sesi dalam 3 menit.
// Setelah ambang, escalation ke admin (bukan hanya balasan generik).
const ABUSE_WINDOW_MS = 3 * 60_000;
const ABUSE_THRESHOLD = 3;
const abuseCounts = new Map<string, { count: number; firstAt: number }>();

function isEscalatedAbuser(chatSessionId: string, message: string): boolean {
  const lower = message.toLowerCase();
  const abusiveSignal = /(kurang ajar|bodoh|tolol|bego|goblok|bangsat|anjing|asu|kontol|memek|sialan|babi)/i.test(lower);
  if (!abusiveSignal) return false;
  const now = Date.now();
  const state = abuseCounts.get(chatSessionId);
  if (!state || now - state.firstAt > ABUSE_WINDOW_MS) {
    abuseCounts.set(chatSessionId, { count: 1, firstAt: now });
    return false;
  }
  state.count += 1;
  if (state.count >= ABUSE_THRESHOLD) {
    abuseCounts.delete(chatSessionId);
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  const rate = await checkRateLimit(`chat-v3:${getClientIp(req)}`, 40, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak chat. Coba lagi sebentar.' }, { status: 429 });

  const parsed = SendChatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Pesan tidak valid' }, { status: 400 });

  const chatSessionId = parsed.data.chatSessionId;
  if (!chatSessionId) return NextResponse.json({ ok: false, error: 'Chat session belum siap' }, { status: 400 });

  let chatSession;
  try {
    chatSession = await requireOwnedChatSession(chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }
  let userMessage;
  let aiResponse;

  // Anti-spam: pesan kasar berulang → escalation ke admin.
  if (isEscalatedAbuser(chatSessionId, parsed.data.message)) {
    await db.update(chatSessions).set({ status: 'needs_admin', aiMode: 'paused', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
    userMessage = await createChatMessage({ chatSessionId, role: 'user', content: parsed.data.message, metadata: { escalated: true } });
    aiResponse = {
      reply: 'Aku ingin tetap bantu dengan nyaman. Karena beberapa pesan terakhir kurang nyaman, aku alihkan chat ini ke admin yang bisa melayani kakak ya.',
      intent: 'handoff_to_admin' as const,
      components: [{ type: 'admin_handoff_card' as const, reason: 'Pesan kasar berulang' }],
      confidence: 1.0,
    };
  } else {
    // Guard prompt-injection + redaksi PII sebelum masuk model.
    const guard = guardInput(parsed.data.message);

  if (chatSession.aiMode !== 'enabled') {
    aiResponse = await buildPausedChatResponse(chatSessionId, parsed.data.message);
    if (!aiResponse) {
      return NextResponse.json({ ok: false, error: 'Chat sedang di-handle admin. Tunggu balasan admin ya kak.' }, { status: 409 });
    }
    userMessage = await createChatMessage({ chatSessionId, role: 'user', content: parsed.data.message });
  } else if (guard.status === 'blocked') {
    userMessage = await createChatMessage({ chatSessionId, role: 'user', content: parsed.data.message, metadata: { blocked: true, reason: guard.reason } });
    aiResponse = {
      reply: BLOCKED_REPLY,
      intent: 'unsupported' as const,
      components: [{ type: 'quick_replies' as const, options: [
        { id: 'guard-produk', label: 'Lihat Produk', value: 'lihat produk', action: 'send_message' as const },
        { id: 'guard-cart', label: 'Lihat Keranjang', value: 'lihat keranjang', action: 'send_message' as const },
      ] }],
      confidence: 1.0,
    };
  } else {
    userMessage = await createChatMessage({ chatSessionId, role: 'user', content: guard.sanitized, metadata: parsed.data.message !== guard.sanitized ? { redacted: true } : undefined });
    rememberChatSignals(chatSessionId, guard.sanitized).catch(() => undefined);
    try {
      aiResponse = await buildChatResponse(chatSessionId, guard.sanitized);
      updateContextSummary(chatSessionId, guard.sanitized, aiResponse).catch(() => undefined);
    } catch (err) {
      console.error('[Chat API] AI orchestrator error:', err);
      aiResponse = {
        reply: 'Maaf kak, koneksi AI kami sedang mengalami kendala. Kakak bisa ketik ulang, atau langsung hubungi admin kami ya!',
        intent: 'handoff_to_admin' as const,
        components: [
          { type: 'admin_handoff_card' as const, reason: 'Koneksi AI terputus' },
          {
            type: 'quick_replies' as const,
            options: [
              { id: 'fb-produk', label: 'Lihat Katalog', value: 'lihat produk', action: 'send_message' as const },
              { id: 'fb-cart', label: 'Lihat Keranjang', value: 'lihat keranjang', action: 'send_message' as const },
            ]
          }
        ],
        confidence: 0.3
      };
    }
  }
  }

  const assistantMessage = await createChatMessage({
    chatSessionId,
    role: aiResponse.intent === 'handoff_to_admin' ? 'system' : 'assistant',
    content: aiResponse.reply,
    components: aiResponse.components,
    metadata: { intent: aiResponse.intent, nextAction: aiResponse.nextAction, confidence: aiResponse.confidence },
  });

  await updateChatSessionTitle(chatSessionId, parsed.data.message, aiResponse.intent);

  const { getChatV3Stage } = await import('@/lib/chat-v3/stage');
  return NextResponse.json({ ok: true, userMessage, assistantMessage, response: aiResponse, messages: await getChatMessages(chatSessionId), cart: await getChatCart(chatSessionId), stage: await getChatV3Stage(chatSessionId) });
}
