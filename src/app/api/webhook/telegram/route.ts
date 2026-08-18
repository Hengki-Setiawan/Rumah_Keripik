import {NextRequest, NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {pelangganChatbot, pesanChat} from '@/lib/schema'
import {eq, sql} from 'drizzle-orm'
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  answerTelegramCallbackQuery,
  setTelegramCommands,
  parseTelegramPayload,
  setTelegramWebhook,
  getTelegramWebhookInfo,
  telegramWebhookSecretMatches,
} from '@/lib/telegram-bot'
import {formatTelegramChatId} from '@/lib/utils'
import {resolvePublicBaseUrl} from '@/lib/public-url'
import {pushTelegramAdminNotification} from '@/lib/telegram-admin'
import {requireAdminRoleOrResponse} from '@/lib/admin-actor'

const BANTUAN_TEXT = `*Bantuan & Cara Pesan di Telegram*\n\n1. Ketik */start* untuk mulai.\n2. Ketik */menu* untuk melihat katalog produk.\n3. Ketik nama produk untuk memilih (contoh: *Kripik Pedas*).\n4. Ikuti alur: pilih varian, jumlah, lalu *kirim lokasi* (tombol 📎 -> Location) sebagai alamat pengiriman.\n5. Selesaikan pembayaran sesuai petunjuk.\n\nCek status pesanan: ketik */status* atau ketik kode pesanan (contoh: *RK-1234*).\n\nKalau butuh bantuan langsung dari admin, admin akan membalas di chat ini.`

async function saveOutgoingMessage(noWaPelanggan: string, text: string) {
  try {
    await db.insert(pesanChat).values({
      no_wa_pelanggan: noWaPelanggan,
      channel: 'telegram',
      direction: 'out',
      sumber: 'bot',
      teks: text,
      id_external: 'bot-' + Date.now(),
      status_kirim: 'sent',
    })
  } catch (dbErr) {
    console.error('[Telegram Webhook] Gagal menyimpan pesan keluar bot ke db:', dbErr)
  }
}

export async function POST(req: NextRequest) {
  if (!telegramWebhookSecretMatches(req.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json(
      { ok: false, error: process.env.TELEGRAM_WEBHOOK_SECRET ? 'Webhook tidak sah' : 'TELEGRAM_WEBHOOK_SECRET belum dikonfigurasi' },
      { status: process.env.TELEGRAM_WEBHOOK_SECRET ? 403 : 503 }
    )
  }

  const body = await req.json()

  const parsed = parseTelegramPayload(body)
  if (!parsed) return NextResponse.json({ ok: true })

  const { chatId, text, firstName, locationData, isCallback, callbackQueryId } = parsed
  const externalId = formatTelegramChatId(chatId)

  // Akui klik tombol (callback_query) agar tombol tidak "loading" terus
  if (isCallback && callbackQueryId) {
    await answerTelegramCallbackQuery(callbackQueryId).catch(() => {})
  }

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
    pushTelegramAdminNotification({
      title: '💬 Chat Telegram Baru',
      body: `${firstName ? `${firstName} (${chatId})` : chatId} mulai chat di bot Telegram.`,
      dedupeKey: `newchat:${externalId}`,
      actions: [{ text: 'Buka Live Chat', url: `${resolvePublicBaseUrl()}/hub-komunikasi` }],
    }).catch(() => {})
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
    const lower = (text || '').trim().toLowerCase()

    // Perintah khusus bot
    if (lower === '/bantuan' || lower === 'bantuan' || lower === 'help') {
      await sendTelegramMessageWithKeyboard(chatId, BANTUAN_TEXT, [
        [{ text: '🛍️ Lihat Katalog', callback_data: 'menu' }],
        [{ text: '📦 Cek Status Pesanan', callback_data: 'status' }],
      ])
      await saveOutgoingMessage(externalId, BANTUAN_TEXT)
      return NextResponse.json({ ok: true })
    }

    let inputText = text
    if (lower === '/start' || lower === 'start') inputText = 'halo'
    else if (lower === '/menu' || lower === '/katalog') inputText = 'menu'
    else if (lower === '/status') inputText = 'status'

    if (!inputText) return NextResponse.json({ ok: true })

    const { processIncomingMessage } = await import('@/lib/chatbot-router')
    const result = await processIncomingMessage(externalId, inputText, false, undefined, locationData)

    if (result.response) {
      await sendTelegramMessage(chatId, result.response)
      await saveOutgoingMessage(externalId, result.response)
    }
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err)
    await sendTelegramMessage(chatId, 'Maaf, terjadi gangguan. Coba lagi nanti ya.')
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const denied = await requireAdminRoleOrResponse('chat:manage')
  if (denied) return denied

  const url = new URL(req.url)
  const setup = url.searchParams.get('setup')

  if (setup === 'webhook') {
    const baseUrl = resolvePublicBaseUrl(`${url.protocol}//${url.host}`)
    const webhookUrl = `${baseUrl}/api/webhook/telegram`
    const webhookOk = await setTelegramWebhook(webhookUrl)
    const commandsOk = await setTelegramCommands()
    const info = await getTelegramWebhookInfo()
    return NextResponse.json({ ok: webhookOk && commandsOk, webhookOk, commandsOk, webhookUrl, info })
  }

  return NextResponse.json({
    ok: true,
    message: 'Telegram webhook aktif. Tambahkan ?setup=webhook untuk set webhook URL.',
  })
}