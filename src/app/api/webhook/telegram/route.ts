import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pelangganChatbot, pesanChat, chatLog } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { sendTelegramMessage, sendTelegramTyping, parseTelegramPayload, setTelegramWebhook, getTelegramWebhookInfo } from '@/lib/telegram-bot'
import { formatTelegramChatId } from '@/lib/utils'
import { callGroqLLM } from '@/lib/groq'
import { generateQueryEmbedding, toTursoVectorString } from '@/lib/gemini'
import { createClient } from '@libsql/client'
import { getSystemPrompt } from '@/lib/chatbot-prompts'
import { resolvePublicBaseUrl } from '@/lib/public-url'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const parsed = parseTelegramPayload(body)
  if (!parsed) return NextResponse.json({ ok: true })

  const { chatId, text, firstName, locationData } = parsed
  const externalId = formatTelegramChatId(chatId)

  const [pelanggan] = await db
    .select()
    .from(pelangganChatbot)
    .where(eq(pelangganChatbot.no_wa_pelanggan, externalId))
    .limit(1)

  if (!pelanggan) {
    await db.insert(pelangganChatbot).values({
      no_wa_pelanggan: externalId,
      nama_pelanggan: firstName,
      channel: 'telegram',
    })
  } else {
    await db
      .update(pelangganChatbot)
      .set({ terakhir_aktif: sql`(datetime('now', 'utc'))`, nama_pelanggan: firstName ?? pelanggan.nama_pelanggan })
      .where(eq(pelangganChatbot.no_wa_pelanggan, externalId))
  }

  // Simpan pesan masuk dari Telegram ke database agar muncul di Live Chat
  try {
    await db.insert(pesanChat).values({
      no_wa_pelanggan: externalId,
      channel: 'telegram',
      direction: 'in',
      sumber: 'pelanggan',
      teks: text,
      id_external: String(Date.now()),
      status_kirim: 'sent',
    })
  } catch (dbErr) {
    console.error('[Telegram Webhook] Gagal menyimpan pesan masuk ke db:', dbErr)
  }

  if (pelanggan?.status_handle === 'Manual_Admin') {
    return NextResponse.json({ ok: true })
  }

  try {
    const { processIncomingMessage } = await import('@/lib/chatbot-router')
    const result = await processIncomingMessage(externalId, text, false, undefined, locationData)

    if (result.response) {
      await sendTelegramMessage(chatId, result.response)
      try {
        await db.insert(pesanChat).values({
          no_wa_pelanggan: externalId,
          channel: 'telegram',
          direction: 'out',
          sumber: 'bot',
          teks: result.response,
          id_external: 'bot-' + Date.now(),
          status_kirim: 'sent',
        })
      } catch (dbErr) {
        console.error('[Telegram Webhook] Gagal menyimpan pesan keluar bot ke db:', dbErr)
      }
    }
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err)
    await sendTelegramMessage(chatId, 'Maaf, terjadi gangguan. Coba lagi nanti ya.')
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const setup = url.searchParams.get('setup')

  if (setup === 'webhook') {
    const baseUrl = resolvePublicBaseUrl(`${url.protocol}//${url.host}`)
    const webhookUrl = `${baseUrl}/api/webhook/telegram`
    const ok = await setTelegramWebhook(webhookUrl)
    const info = await getTelegramWebhookInfo()
    return NextResponse.json({ ok, webhookUrl, info })
  }

  return NextResponse.json({
    ok: true,
    message: 'Telegram webhook aktif. Tambahkan ?setup=webhook untuk set webhook URL.',
  })
}
