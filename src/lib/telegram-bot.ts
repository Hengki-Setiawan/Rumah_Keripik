const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

import { createHash, timingSafeEqual } from 'crypto'

export function telegramWebhookSecretMatches(value: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || !value) return false
  const a = createHash('sha256').update(value).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

interface TelegramUser {
  id: number
  first_name?: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
}

interface TelegramMessage {
  message_id: number
  chat: TelegramChat
  text?: string
  location?: { latitude: number; longitude: number; horizontal_accuracy?: number }
  venue?: { location: { latitude: number; longitude: number }; title?: string; address?: string }
  from?: TelegramUser
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export interface TelegramParsedPayload {
  chatId: string
  text: string
  firstName?: string
  locationData?: { lat: number; lng: number; address?: string }
  isCallback: boolean
  callbackQueryId?: string
}

const MAX_MESSAGE_LENGTH = 4000

function chunkText(text: string, max: number = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max)
    if (cut <= 0) cut = max
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  if (rest) parts.push(rest)
  return parts
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<boolean> {
  let allOk = true
  for (const part of chunkText(text)) {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chatId), text: part }),
    })
    if (!res.ok) {
      console.error('[Telegram] sendMessage gagal:', await res.text().catch(() => ''))
      allOk = false
    }
  }
  return allOk
}

interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

export async function sendTelegramMessageWithKeyboard(
  chatId: number | string,
  text: string,
  buttons: InlineKeyboardButton[][],
): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Number(chatId),
      text,
      reply_markup: { inline_keyboard: buttons },
    }),
  })
  if (!res.ok) {
    console.error('[Telegram] sendMessageWithKeyboard gagal:', await res.text().catch(() => ''))
  }
  return res.ok
}

export async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      ...(text ? { text, show_alert: false } : {}),
    }),
  })
  return res.ok
}

export async function setTelegramCommands(): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Mulai pesan / menu utama' },
        { command: 'menu', description: 'Lihat katalog produk' },
        { command: 'status', description: 'Cek status pesanan' },
        { command: 'bantuan', description: 'Bantuan & cara pesan' },
      ],
    }),
  })
  return res.ok
}

export async function setTelegramWebhook(url: string): Promise<boolean> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      allowed_updates: ['message', 'callback_query'],
      ...(secretToken ? { secret_token: secretToken } : {}),
    }),
  })
  return res.ok
}

export async function getTelegramWebhookInfo(): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
  return res.json()
}

export async function getTelegramBotInfo(): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API}/getMe`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
  return res.json()
}

export function parseTelegramPayload(body: unknown): TelegramParsedPayload | null {
  const payload = body as Record<string, unknown> | undefined

  const cq = payload?.callback_query as TelegramCallbackQuery | undefined
  if (cq?.message?.chat?.id && cq.id) {
    const msg = cq.message
    const location = msg.location
      ? { lat: msg.location.latitude, lng: msg.location.longitude }
      : msg.venue
        ? {
            lat: msg.venue.location.latitude,
            lng: msg.venue.location.longitude,
            address: [msg.venue.title, msg.venue.address].filter(Boolean).join(', ') || undefined,
          }
        : undefined

    return {
      chatId: String(msg.chat.id),
      text: cq.data || '',
      firstName: cq.from?.first_name,
      locationData: location,
      isCallback: true,
      callbackQueryId: cq.id,
    }
  }

  const msg = (payload?.message as TelegramMessage | undefined)
    ?? (payload?.edited_message as TelegramMessage | undefined)
    ?? (payload?.channel_post as TelegramMessage | undefined)
  if (!msg?.chat?.id) return null

  const location = msg.location
    ? { lat: msg.location.latitude, lng: msg.location.longitude }
    : msg.venue
      ? {
          lat: msg.venue.location.latitude,
          lng: msg.venue.location.longitude,
          address: [msg.venue.title, msg.venue.address].filter(Boolean).join(', ') || undefined,
        }
      : undefined

  if (!msg.text && !location) return null

  return {
    chatId: String(msg.chat.id),
    text: msg.text || '[location]',
    firstName: msg.from?.first_name,
    locationData: location,
    isCallback: false,
  }
}