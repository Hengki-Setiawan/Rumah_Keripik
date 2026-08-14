/**
 * Fonnte WA Gateway — satu-satunya gateway WhatsApp yang dipakai.
 * Dipakai untuk kirim OTP (lih. lib/identity/otp.ts) dan notifikasi teks ke pelanggan.
 */

async function postFonnte(target: string, message: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return { ok: false, error: 'Fonnte belum dikonfigurasi' };
  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        target,
        countryCode: '62',
        message,
        typing: 'false',
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: `Fonnte error ${response.status}` };
    const id = data?.id;
    const status = data?.status;
    const hasId = Array.isArray(id) ? id.length > 0 : typeof id === 'string' && id.length > 0;
    if (status === true && hasId) {
      const firstId = Array.isArray(id) ? id[0] : id;
      return { ok: true, id: typeof firstId === 'string' ? firstId : undefined };
    }
    if (status === 0 || status === false || !hasId) return { ok: false, error: 'Fonnte mengantre tetapi belum terkirim' };
    return { ok: false, error: 'Fonnte gagal mengirim, coba lagi nanti' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Fonnte gagal: ${error.message}` : 'Fonnte gagal' };
  }
}

export async function sendTextMessage(to: string, text: string): Promise<{ success: boolean; error?: string; id?: string }> {
  const result = await postFonnte(to, text);
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, id: result.id };
}