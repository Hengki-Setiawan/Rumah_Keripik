import { db } from '@/lib/db';
import { telegramAdminChats } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { sendTelegramMessage } from '@/lib/telegram-bot';

export async function registerTelegramAdminChat(chatId: string, nama?: string | null): Promise<boolean> {
  try {
    const cleanId = chatId.replace(/^tg_/, '').replace(/\D/g, '');
    if (!cleanId) return false;
    const existing = await db.select().from(telegramAdminChats).where(eq(telegramAdminChats.chatId, cleanId)).limit(1);
    if (existing[0]) {
      await db.update(telegramAdminChats).set({ isActive: true, nama: nama ?? existing[0].nama }).where(eq(telegramAdminChats.chatId, cleanId));
    } else {
      await db.insert(telegramAdminChats).values({ chatId: cleanId, nama: nama ?? null, isActive: true });
    }
    await sendTelegramMessage(cleanId, '✅ Chat ini terdaftar sebagai penerima notifikasi admin Rumah Keripik.');
    return true;
  } catch (err) {
    console.error('[TelegramAdminChats] register failed:', err);
    return false;
  }
}

export async function removeTelegramAdminChat(chatId: string): Promise<void> {
  const cleanId = chatId.replace(/^tg_/, '').replace(/\D/g, '');
  if (!cleanId) return;
  await db.update(telegramAdminChats).set({ isActive: false }).where(eq(telegramAdminChats.chatId, cleanId));
}