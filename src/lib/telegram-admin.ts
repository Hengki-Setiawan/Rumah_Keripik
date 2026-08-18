import { db } from '@/lib/db';
import { telegramAdminChats } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { sendTelegramMessage, sendTelegramMessageWithKeyboard } from '@/lib/telegram-bot';

export interface TelegramAdminNotifInput {
  title: string;
  body?: string;
  actions?: Array<{ text: string; url?: string; callback_data?: string }>;
  dedupeKey?: string;
}

const DEDUPE_MS = 8000;
const recent: Map<string, number> = new Map();

/**
 * Ambil daftar chat id admin penerima notifikasi.
 * Sumber: env TELEGRAM_ADMIN_CHAT_ID (koma) + tabel telegram_admin_chats (aktif).
 */
export async function getTelegramAdminChatIds(): Promise<string[]> {
  const ids = new Set<string>();
  const envValue = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (envValue) {
    envValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  try {
    const rows = await db.select().from(telegramAdminChats).where(eq(telegramAdminChats.isActive, true));
    rows.forEach((row) => ids.add(String(row.chatId)));
  } catch {
    // Tabel mungkin belum ada (pre-migrasi) — abaikan, fallback ke env.
  }
  return [...ids];
}

/**
 * Kirim notifikasi ke semua chat admin Telegram (fire-and-forget di pemanggil).
 * Ada dedupe singkat (8 detik) per dedupeKey/title untuk mencegah spam ganda.
 */
export async function pushTelegramAdminNotification(input: TelegramAdminNotifInput): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;

  const key = input.dedupeKey || input.title;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return false;
  recent.set(key, now);

  const ids = await getTelegramAdminChatIds();
  if (ids.length === 0) return false;

  let text = input.title;
  if (input.body) text += `\n\n${input.body}`;

  const buttons =
    input.actions?.length
      ? [input.actions.map((a) => (a.url ? { text: a.text, url: a.url } : { text: a.text, callback_data: a.callback_data ?? a.text }))]
      : undefined;

  let ok = true;
  for (const id of ids) {
    const sent = buttons
      ? await sendTelegramMessageWithKeyboard(id, text, buttons)
      : await sendTelegramMessage(id, text);
    if (!sent) ok = false;
  }
  return ok;
}