/**
 * WhatsApp Cloud API Helper (Meta)
 *
 * Gateway untuk kirim/terima pesan via WhatsApp Cloud API (Meta).
 * Alternatif untuk Evolution API — blueprint v2.0 menggunakan Meta langsung.
 * Aktifkan dengan set env: WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN
 * Jika tidak di-set, passthrough ke evolution.ts sebagai fallback.
 */

const WA_API_VERSION = process.env.WA_API_VERSION || 'v22.0';
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '';
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || '';

const BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_NUMBER_ID}`;

function isEnabled(): boolean {
  return !!(WA_PHONE_NUMBER_ID && WA_ACCESS_TOKEN);
}

async function sendRequest(endpoint: string, body: Record<string, unknown>) {
  if (!isEnabled()) return null;

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[WA Cloud] API error:', res.status, err);
    return null;
  }

  return res.json();
}

export async function sendTextMessage(to: string, text: string) {
  if (!isEnabled()) return null;
  return sendRequest('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  });
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  components?: { type: string; parameters: { type: string; text: string }[] }[],
) {
  if (!isEnabled()) return null;
  return sendRequest('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'id' },
      components,
    },
  });
}

export async function sendImageMessage(to: string, imageUrl: string, caption?: string) {
  if (!isEnabled()) return null;
  return sendRequest('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  });
}

export async function sendListMessage(
  to: string,
  header: string,
  body: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
) {
  if (!isEnabled()) return null;
  return sendRequest('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: header },
      body: { text: body },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
) {
  if (!isEnabled()) return null;
  return sendRequest('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: b })) },
    },
  });
}

export async function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): Promise<string | null> {
  const verifyToken = process.env.WA_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return challenge;
  }
  return null;
}

export function parseIncomingMessage(body: any) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return null;

  return {
    from: message.from?.replace(/[^0-9]/g, ''),
    messageId: message.id,
    type: message.type,
    text: message.text?.body || '',
    timestamp: new Date((message.timestamp || 0) * 1000).toISOString(),
    name: value?.contacts?.[0]?.profile?.name || '',
    image: message.image?.link || message.image?.id || null,
    location: message.location
      ? { lat: message.location.latitude, lng: message.location.longitude }
      : null,
  };
}
