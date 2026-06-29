const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

interface TelegramMessage {
  message_id: number
  chat: { id: number; type: string }
  text?: string
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

export async function sendTelegramTyping(chatId: number | string): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Number(chatId), action: 'typing' }),
  })
}

export async function setTelegramWebhook(url: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message'] }),
  })
  return res.ok
}

export function parseTelegramPayload(body: unknown): {
  chatId: string
  text: string
  firstName?: string
} | null {
  const msg = (body as any)?.message as TelegramMessage | undefined
  if (!msg?.text || !msg?.chat?.id) return null
  return {
    chatId: String(msg.chat.id),
    text: msg.text,
    firstName: msg.from?.first_name,
  }
}
