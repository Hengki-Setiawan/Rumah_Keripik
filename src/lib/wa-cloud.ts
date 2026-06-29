/**
 * WhatsApp Cloud API Helper
 * Untuk integrasi dengan WhatsApp Cloud API (Meta)
 * Dokumentasi: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Environment variables:
 *   WA_ACCESS_TOKEN    — Token dari Meta (System User atau permanent token)
 *   WA_PHONE_NUMBER_ID — ID nomor telepon WhatsApp Business
 *   WA_VERIFY_TOKEN    — Token bebas untuk verifikasi webhook
 *   WA_API_VERSION     — Version Graph API (default: v22.0)
 */

const API_VERSION = process.env.WA_API_VERSION || 'v22.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;

interface WaTextMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

interface WaInteractiveButton {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: {
      buttons: { type: 'reply'; reply: { id: string; title: string } }[];
    };
  };
}

interface WaInteractiveList {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    body: { text: string };
    action: {
      sections: {
        title: string;
        rows: { id: string; title: string; description?: string }[];
      }[];
    };
  };
}

type WaMessagePayload = WaTextMessage | WaInteractiveButton | WaInteractiveList;

interface WaResponse {
  messaging_product: 'whatsapp';
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

export interface IncomingMessage {
  from: string;
  message_id: string;
  text: string;
  timestamp: string;
  name: string;
}

/**
 * Kirim pesan teks via WhatsApp Cloud API
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return { success: false, error: 'WA_ACCESS_TOKEN atau WA_PHONE_NUMBER_ID tidak dikonfigurasi' };
  }

  try {
    const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      } satisfies WaTextMessage),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('WA Cloud API Error:', JSON.stringify(error));
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }

    const data: WaResponse = await response.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('WA Cloud API send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Kirim interactive buttons (max 3 buttons, title max 20 chars)
 */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: { id: string; title: string }[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return { success: false, error: 'WA_ACCESS_TOKEN atau WA_PHONE_NUMBER_ID tidak dikonfigurasi' };
  }

  try {
    const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      } satisfies WaInteractiveButton),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }

    const data: WaResponse = await response.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('WA Cloud API button error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Kirim interactive list menu
 */
export async function sendListMessage(
  to: string,
  body: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return { success: false, error: 'WA_ACCESS_TOKEN atau WA_PHONE_NUMBER_ID tidak dikonfigurasi' };
  }

  try {
    const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: { sections },
        },
      } satisfies WaInteractiveList),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }

    const data: WaResponse = await response.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('WA Cloud API list error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Verifikasi webhook (GET request dari Meta)
 * Return challenge string jika verify_token cocok
 */
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): { verified: boolean; challenge: string | null } {
  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return { verified: true, challenge };
  }
  return { verified: false, challenge: null };
}

/**
 * Parse incoming webhook payload — extract pesan teks dan metadata pengirim
 */
export function parseIncomingMessage(body: unknown): IncomingMessage | null {
  try {
    const payload = body as Record<string, unknown>;
    const entry = (payload?.entry as Record<string, unknown>[])?.[0];
    const change = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = change?.value as Record<string, unknown> | undefined;
    const messages = value?.messages as Record<string, unknown>[] | undefined;

    if (!messages || messages.length === 0) {
      return null;
    }

    const msg = messages[0];
    const contacts = value?.contacts as Record<string, unknown>[] | undefined;
    const contact = contacts?.[0]?.profile as Record<string, unknown> | undefined;

    const textBody =
      msg?.type === 'text' ? ((msg?.text as Record<string, unknown>)?.body as string) ?? '' : '';

    return {
      from: msg?.from as string,
      message_id: msg?.id as string,
      text: textBody,
      timestamp: msg?.timestamp as string,
      name: (contact?.name as string) ?? '',
    };
  } catch (error) {
    console.error('Error parsing WA webhook:', error);
    return null;
  }
}

/**
 * Cek apakah payload adalah status update (bukan pesan baru)
 */
export function isStatusUpdate(body: unknown): boolean {
  try {
    const payload = body as Record<string, unknown>;
    const entry = (payload?.entry as Record<string, unknown>[])?.[0];
    const change = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = change?.value as Record<string, unknown> | undefined;
    return !value?.messages && !!value?.statuses;
  } catch {
    return false;
  }
}
