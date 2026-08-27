/**
 * Cloudflare Workers AI Client
 * Provider: Workers AI Serverless GPU
 * Models:
 *   - @cf/meta/llama-3.3-70b-instruct-fp8-fast (Flagship 70B deep reasoning)
 *   - @cf/meta/llama-3.1-8b-instruct-fast (Super-fast 8B helper)
 *   - @cf/openai/whisper (Audio to text transcription)
 */

export interface WorkersAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface WorkersAIResult {
  text: string;
  provider: 'workers-ai';
  model: string;
  tokensUsed?: number;
}

export const WORKERS_AI_MODELS = {
  SMART_70B: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  FAST_8B: '@cf/meta/llama-3.1-8b-instruct-fast',
  WHISPER: '@cf/openai/whisper',
} as const;

/**
 * Memanggil Workers AI via native binding atau REST fallback
 */
export async function callWorkersAI(
  messages: WorkersAIMessage[],
  maxTokens: number = 1024,
  temperature: number = 0.7,
  systemPrompt?: string,
  model: string = WORKERS_AI_MODELS.FAST_8B
): Promise<WorkersAIResult> {
  const formattedMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  // 1. Coba panggil via Cloudflare native binding (saat di production edge)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env && (ctx.env as any).AI) {
      const ai = (ctx.env as any).AI;
      const res = await ai.run(model, {
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
      });

      const responseText = res?.response || res?.result?.response || (typeof res === 'string' ? res : '');
      if (responseText) {
        return {
          text: responseText.trim(),
          provider: 'workers-ai',
          model,
        };
      }
    }
  } catch (bindingError: any) {
    // Di lingkungan lokal (next dev tanpa wrangler) getCloudflareContext mungkin tidak ada AI binding
    // Lanjut ke REST API fallback di bawah
  }

  // 2. Fallback via Cloudflare REST API jika binding tidak tersedia
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    const restUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const restRes = await fetch(restUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (restRes.ok) {
      const data = await restRes.json();
      const responseText = data?.result?.response || '';
      return {
        text: responseText.trim(),
        provider: 'workers-ai',
        model,
      };
    }
  }

  throw new Error(`Workers AI tidak dapat dieksekusi (binding & REST tidak tersedia)`);
}

/**
 * Transkripsi pesan suara audio (Voice Note) menjadi teks menggunakan Whisper
 */
export async function transcribeVoiceNote(audioBytes: Uint8Array): Promise<string> {
  // 1. Coba via binding
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env && (ctx.env as any).AI) {
      const ai = (ctx.env as any).AI;
      const res = await ai.run(WORKERS_AI_MODELS.WHISPER, [...audioBytes]);
      return res?.text?.trim() || '';
    }
  } catch {
    // Lanjut ke REST fallback
  }

  // 2. Fallback via REST API
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    const restUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${WORKERS_AI_MODELS.WHISPER}`;
    const restRes = await fetch(restUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: audioBytes as unknown as BodyInit,
    });

    if (restRes.ok) {
      const data = await restRes.json();
      return data?.result?.text?.trim() || '';
    }
  }

  throw new Error('Transkripsi audio gagal via Cloudflare Workers AI');
}
