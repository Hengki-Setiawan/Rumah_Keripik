/**
 * Cloudflare Turnstile Verification Utility
 * Melindungi form order dan login admin dari serangan bot tanpa puzzle yang mengganggu.
 */

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  challengeTs?: string;
  hostname?: string;
  bypassed?: boolean;
}

/**
 * Verifikasi Turnstile token dengan Cloudflare Siteverify API
 */
export async function verifyTurnstileToken(
  token?: string | null,
  remoteIp?: string | null
): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Jika secret key belum dikonfigurasi di environment, izinkan lewat (graceful bypass)
  if (!secretKey) {
    return { success: true, bypassed: true };
  }

  // Jika secret key ada tapi token tidak dikirim
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    return {
      success: !!data.success,
      errorCodes: data['error-codes'],
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
    };
  } catch (err: any) {
    console.warn('Error verifikasi Turnstile token:', err);
    // Jangan gagalkan transaksi jika API Turnstile mengalami network glitch
    return { success: true, bypassed: true };
  }
}
