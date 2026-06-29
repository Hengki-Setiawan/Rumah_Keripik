/**
 * Evolution API Helper
 * Untuk integrasi dengan Evolution API v2 (WhatsApp Gateway).
 * Dipakai untuk kirim pesan, cek status instance, dan parse webhook inbound.
 */

const BASE_URL = process.env.EVOLUTION_API_URL || 'https://wa.rumahkripik.com';
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'rumah-kripik-bot';

interface EvolutionRequest {
  number?: string;
  text?: string;
  [key: string]: unknown;
}

interface EvolutionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface EvolutionIncomingMessage {
  from: string;
  message_id: string;
  text: string;
  timestamp: string;
  name: string;
  fromMe: boolean;
}

/**
 * Generic fetch helper untuk Evolution API
 */
async function evolutionFetch(
  endpoint: string,
  method: string = 'GET',
  body?: EvolutionRequest
): Promise<EvolutionResponse> {
  if (!API_KEY) {
    throw new Error('EVOLUTION_API_KEY tidak ditemukan di environment');
  }

  const url = `${BASE_URL}${endpoint}/${INSTANCE}`;

  try {
    const options: RequestInit = {
      method,
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Evolution API Error (${response.status}):`, error);
      throw new Error(`Evolution API: ${error.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Error calling Evolution API (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Kirim pesan teks ke nomor WhatsApp
 */
export async function sendTextMessage(number: string, text: string): Promise<EvolutionResponse> {
  if (!number || !text) {
    throw new Error('Nomor dan teks pesan wajib diisi');
  }

  return evolutionFetch('/message/sendText', 'POST', {
    number,
    text,
  });
}

/**
 * Kirim pesan dengan tombol (quick reply buttons)
 */
export async function sendButtonMessage(
  number: string,
  text: string,
  buttons: { displayText: string; id: string }[]
): Promise<EvolutionResponse> {
  return evolutionFetch('/message/sendButtons', 'POST', {
    number,
    title: text,
    buttons: buttons.map((btn) => ({
      displayText: btn.displayText,
      id: btn.id,
    })),
  });
}

/**
 * Kirim pesan list/menu
 */
export async function sendListMessage(
  number: string,
  title: string,
  sections: { title: string; rows: { title: string; description?: string; rowId: string }[] }[]
): Promise<EvolutionResponse> {
  return evolutionFetch('/message/sendList', 'POST', {
    number,
    title,
    sections,
  });
}

/**
 * Ambil riwayat pesan masuk dari WhatsApp (untuk hybrid chat)
 * Query ke Evolution API Postgres storage (Baileys)
 */
export async function getInboundMessageHistory(
  no_wa: string,
  limit: number = 50
): Promise<
  {
    direction: 'in';
    sumber: 'konsumen';
    teks: string;
    timestamp: string;
  }[]
> {
  try {
    const response = await evolutionFetch(`/chat/findMessages?phone=${no_wa}&limit=${limit}`, 'GET');

    if (!response.success || !response.data) {
      console.warn('⚠️ Gagal ambil riwayat pesan dari Evolution');
      return [];
    }

    // Format messages dari Evolution ke unified format
    const messages = Array.isArray(response.data) ? response.data : [];

    return messages
      .filter((msg: any) => msg.fromMe === false) // Hanya pesan masuk
      .map((msg: any) => ({
        direction: 'in' as const,
        sumber: 'konsumen' as const,
        teks: msg.body || '[media]',
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (error) {
    console.error('❌ Error fetch inbound history:', error);
    // Graceful degradation: return empty array jika error
    return [];
  }
}

/**
 * Cek status koneksi WhatsApp instance
 */
export async function checkInstanceStatus(): Promise<boolean> {
  try {
    const response = await evolutionFetch('/instance/connectionState', 'GET');
    return response.success && (response.data as { state?: string })?.state === 'open';
  } catch (error) {
    console.error('❌ Error check instance status:', error);
    return false;
  }
}

/**
 * Restart WhatsApp instance (jika diperlukan)
 */
export async function restartInstance(): Promise<EvolutionResponse> {
  return evolutionFetch('/instance/restart', 'POST');
}

/**
 * Logout dari WhatsApp instance
 */
export async function logoutInstance(): Promise<EvolutionResponse> {
  return evolutionFetch('/instance/logout', 'POST');
}

/**
 * Ambil QR code untuk scan WhatsApp
 * Gunakan saat setup instance pertama kali
 */
export async function getQRCode(): Promise<string | null> {
  try {
    const response = await evolutionFetch('/instance/connect', 'GET');
    return (response.data as { qrcode?: string })?.qrcode || null;
  } catch (error) {
    console.error('❌ Error get QR code:', error);
    return null;
  }
}
