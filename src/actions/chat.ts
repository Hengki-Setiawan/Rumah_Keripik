'use server';

import { db } from '@/lib/db';
import { pelangganChatbot, pesanChat } from '@/lib/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { sendTelegramMessage } from '@/lib/telegram-bot';
import { detectChannel, parseTelegramChatId } from '@/lib/utils';
import { sendTextMessage as sendEvolutionMessage, getInboundMessageHistory } from '@/lib/evolution';

export async function getDaftarChat() {
  try {
    return await db
      .select()
      .from(pelangganChatbot)
      .orderBy(desc(pelangganChatbot.terakhir_aktif));
  } catch (error) {
    console.error('Error fetch daftar chat:', error);
    return [];
  }
}

export async function ambilAlihChat(no_wa: string, adminName?: string) {
  try {
    if (adminName) {
      const existing = await db
        .select()
        .from(pelangganChatbot)
        .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa))
        .limit(1)
        .then(r => r[0]);

      if (existing?.diambil_oleh && existing.diambil_oleh !== adminName && existing.status_handle === 'Manual_Admin') {
        return { success: false, message: `Sedang dihandle ${existing.diambil_oleh}`, handledBy: existing.diambil_oleh };
      }
    }

    await db
      .update(pelangganChatbot)
      .set({
        status_handle: 'Manual_Admin',
        diambil_oleh: adminName || null,
      })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    revalidatePath('/hub-komunikasi');
    return { success: true, message: 'Chat berhasil diambil alih' };
  } catch (error) {
    return { success: false, message: 'Gagal ambil alih chat' };
  }
}

export async function lepasKeBot(no_wa: string) {
  try {
    await db
      .update(pelangganChatbot)
      .set({
        status_handle: 'AI_Bot',
        context_sesi: null,
        diambil_oleh: null,
      })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    revalidatePath('/hub-komunikasi');
    return { success: true, message: 'Chat dikembalikan ke bot' };
  } catch (error) {
    return { success: false, message: 'Gagal lepas chat' };
  }
}

export async function kirimPesanManual(no_wa: string, pesan: string) {
  try {
    const channel = detectChannel(no_wa)
    let id_external: string | null = null;
    let status_kirim: 'sent' | 'failed' = 'sent';

    if (channel === 'telegram') {
      const chatId = parseTelegramChatId(no_wa)
      const ok = await sendTelegramMessage(chatId, pesan)
      if (!ok) {
        return { success: false, message: 'Telegram API error' }
      }
      id_external = String(Date.now())
    } else {
      const res = await sendEvolutionMessage(no_wa, pesan);

      if (res.success) {
        const data = res.data as { key?: { id?: string }; messageId?: string } | undefined;
        id_external = data?.key?.id ?? data?.messageId ?? null;
      } else {
        status_kirim = 'failed';
        return { success: false, message: `Evolution API error: ${res.error || 'Unknown error'}` };
      }
    }

    await db.insert(pesanChat).values({
      no_wa_pelanggan: no_wa,
      channel,
      direction: 'out',
      sumber: 'admin',
      teks: pesan,
      id_external,
      status_kirim,
    });

    await db
      .update(pelangganChatbot)
      .set({ terakhir_aktif: sql`(datetime('now', 'utc'))` })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));

    revalidatePath('/hub-komunikasi');
    return { success: true, message: 'Pesan terkirim', id_external };
  } catch (error) {
    return { success: false, message: 'Gagal kirim pesan' };
  }
}

export async function getRiwayatChat(no_wa: string) {
  try {
    const outMsgs = await db
      .select({
        channel: pesanChat.channel,
        direction: pesanChat.direction,
        sumber: pesanChat.sumber,
        teks: pesanChat.teks,
        timestamp: pesanChat.timestamp,
      })
      .from(pesanChat)
      .where(eq(pesanChat.no_wa_pelanggan, no_wa))
      .orderBy(desc(pesanChat.timestamp))
      .limit(100);

    const outMessages = outMsgs.reverse();

    let inMessages: {
      channel: string;
      direction: 'in';
      sumber: 'konsumen';
      teks: string;
      timestamp: string;
    }[] = [];

    try {
      const rawIn = await getInboundMessageHistory(no_wa, 100);
      inMessages = rawIn.map((m) => ({
        channel: 'wa',
        direction: 'in' as const,
        sumber: 'konsumen' as const,
        teks: m.teks,
        timestamp: m.timestamp,
      }));
    } catch (err) {
      console.warn('[Live Chat] Evolution inbound gagal, tampilkan pesan keluar saja:', err);
    }

    const merged = [...outMessages, ...inMessages]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return merged;
  } catch (error) {
    console.error('Error fetch riwayat chat:', error);
    return [];
  }
}

export async function getStatsChat() {
  try {
    const [result] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        aktif: sql<number>`SUM(CASE WHEN status_handle = 'AI_Bot' THEN 1 ELSE 0 END)`,
        manual: sql<number>`SUM(CASE WHEN status_handle = 'Manual_Admin' THEN 1 ELSE 0 END)`,
      })
      .from(pelangganChatbot);

    return { aktif: result?.aktif ?? 0, manual: result?.manual ?? 0, total: result?.total ?? 0 };
  } catch (error) {
    return { aktif: 0, manual: 0, total: 0 };
  }
}
