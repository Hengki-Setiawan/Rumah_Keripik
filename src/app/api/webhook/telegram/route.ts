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

export async function POST(req: NextRequest) {
  const body = await req.json()

  const parsed = parseTelegramPayload(body)
  if (!parsed) return NextResponse.json({ ok: true })

  const { chatId, text, firstName } = parsed
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

  if (pelanggan?.status_handle === 'Manual_Admin') {
    return NextResponse.json({ ok: true })
  }

  await sendTelegramTyping(chatId)

  const lower = text.toLowerCase()
  const autoRules = await db
    .select()
    .from(chatLog)
    .where(sql`keyword IS NOT NULL`)
    .limit(0)

  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    })

    const { embedding } = await generateQueryEmbedding(text)
    const vectorStr = toTursoVectorString(embedding)

    const searchResult = await client.execute({
      sql: `
        SELECT potongan_teks FROM ai_knowledge_base
        WHERE is_active = 1
        ORDER BY vector_distance_cos(vector_embedding, vector(?))
        LIMIT 3
      `,
      args: [vectorStr],
    })

    const chunks = searchResult.rows
      .filter((r: any) => Number((r as any).vector_distance_cos ?? 1) < 0.4)
      .map((r: any) => (r as any).potongan_teks as string)

    const context = chunks.length > 0
      ? `Gunakan informasi berikut untuk menjawab:\n${chunks.join('\n\n')}`
      : ''

    const llmResult = await callGroqLLM(
      [{ role: 'user', content: text }],
      1024,
      0.7,
      `${getSystemPrompt()}\n${context}`,
    )

    await sendTelegramMessage(chatId, llmResult.text)

    await db.insert(chatLog).values({
      no_wa_pelanggan: externalId,
      channel: 'telegram',
      user_message: text,
      bot_response: llmResult.text,
      sumber: llmResult.provider.startsWith('groq') ? 'groq' : 'gemini',
      model_used: llmResult.provider,
      tokens_used: 0,
    })

    await db.insert(pesanChat).values({
      no_wa_pelanggan: externalId,
      channel: 'telegram',
      direction: 'out',
      sumber: 'bot',
      teks: llmResult.text,
      id_external: String(Date.now()),
      status_kirim: 'sent',
    })
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
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `${url.protocol}//${url.host}`
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
