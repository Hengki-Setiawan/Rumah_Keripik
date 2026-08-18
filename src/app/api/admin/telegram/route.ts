import {NextRequest, NextResponse} from 'next/server'
import {
  getTelegramBotInfo,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  setTelegramCommands,
  sendTelegramMessage,
} from '@/lib/telegram-bot'
import {resolvePublicBaseUrl} from '@/lib/public-url'
import {getTelegramAdminChatIds} from '@/lib/telegram-admin'
import {adminAuthErrorResponse, requireAdminRole} from '@/lib/admin-actor'

export async function GET() {
  try {
    await requireAdminRole('chat:manage')
    const [bot, webhook, adminChatIds] = await Promise.all([getTelegramBotInfo(), getTelegramWebhookInfo(), getTelegramAdminChatIds()])
    return NextResponse.json({ ok: true, bot, webhook, adminChatIds })
  } catch (err) {
    const authResponse = adminAuthErrorResponse(err)
    if (authResponse) return authResponse
    console.error('[Admin Telegram] GET error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole('chat:manage')
    const body = await req.json().catch(() => ({}))
    const action = body?.action

    if (action === 'setup') {
      const reqUrl = new URL(req.url)
      const baseUrl = resolvePublicBaseUrl(`${reqUrl.protocol}//${reqUrl.host}`)
      const webhookUrl = `${baseUrl}/api/webhook/telegram`
      const webhookOk = await setTelegramWebhook(webhookUrl)
      const commandsOk = await setTelegramCommands()
      const info = await getTelegramWebhookInfo()
      return NextResponse.json({ ok: webhookOk && commandsOk, webhookOk, commandsOk, webhookUrl, info })
    }

    if (action === 'test') {
      const chatId = String(body?.chatId ?? '').trim()
      if (!chatId) {
        return NextResponse.json({ ok: false, error: 'chatId wajib diisi' }, { status: 400 })
      }
      const numericChatId = chatId.replace(/\D/g, '')
      if (!numericChatId) {
        return NextResponse.json({ ok: false, error: 'chatId tidak valid' }, { status: 400 })
      }
      const sent = await sendTelegramMessage(numericChatId, '✅ Tes dari dashboard admin Rumah Keripik — bot Telegram aktif!')
      return NextResponse.json({ ok: sent })
    }

    if (action === 'register-admin-chat') {
      const { registerTelegramAdminChat } = await import('@/lib/telegram-admin-chats')
      const chatId = String(body?.chatId ?? '').trim().replace(/^tg_/, '').replace(/\D/g, '')
      const nama = String(body?.nama ?? '').trim() || null
      if (!chatId) {
        return NextResponse.json({ ok: false, error: 'chatId wajib diisi' }, { status: 400 })
      }
      const registered = await registerTelegramAdminChat(chatId, nama)
      if (!registered) return NextResponse.json({ ok: false, error: 'Gagal mendaftarkan chat id' }, { status: 500 })
      const ids = await getTelegramAdminChatIds()
      return NextResponse.json({ ok: true, adminChatIds: ids })
    }

    if (action === 'remove-admin-chat') {
      const { removeTelegramAdminChat } = await import('@/lib/telegram-admin-chats')
      const chatId = String(body?.chatId ?? '').trim().replace(/^tg_/, '').replace(/\D/g, '')
      if (!chatId) return NextResponse.json({ ok: false, error: 'chatId wajib diisi' }, { status: 400 })
      await removeTelegramAdminChat(chatId)
      const ids = await getTelegramAdminChatIds()
      return NextResponse.json({ ok: true, adminChatIds: ids })
    }

    return NextResponse.json({ ok: false, error: 'Aksi tidak dikenal' }, { status: 400 })
  } catch (err) {
    const authResponse = adminAuthErrorResponse(err)
    if (authResponse) return authResponse
    console.error('[Admin Telegram] POST error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}