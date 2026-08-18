const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

import { createHash, timingSafeEqual } from 'crypto'

export function telegramWebhookSecretMatches(value: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || !value) return false
  const a = createHash('sha256').update(value).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

interface TelegramMessage {
  message_id: number
  chat: { id: number; type: string }
  text?: string
  location?: { latitude: number; longitude: number; horizontal_accuracy?: number }
  venue?: { location: { latitude: number; longitude: number }; title?: string; address?: string }
  from?: { id: number; first_name?: string; username?: string }
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(chatId), text }),
  })
  return res.ok
}

export async function setTelegramWebhook(url: string): Promise<boolean> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message'], ...(secretToken ? { secret_token: secretToken } : {}) }),
  })
  return res.ok
}

export async function getTelegramWebhookInfo(): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  return res.json()
}

export function parseTelegramPayload(body: unknown): {
  chatId: string
  text: string
  firstName?: string
  locationData?: { lat: number; lng: number; address?: string }
} | null {
  const payload = body as Record<string, unknown> | undefined
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
  }
}
