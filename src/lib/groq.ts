/**
 * Groq LLM Client dengan fallback chain
 * Primary: openai/gpt-oss-20b (free tier 1K RPD)
 * Fallback 1: openai/gpt-oss-120b (free tier 1K RPD terpisah)
 * Keduanya gratis; qwen3.6-27b dibuang (harga paid termahal).
 */

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMResult {
  text: string;
  provider: 'groq-20b' | 'groq-120b' | 'gemini';
  model?: string;
  tokensUsed?: number;
}

// Model chain untuk fallback
const GROQ_CHAIN = [
  {
    model: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20b',
    provider: 'groq-20b' as const,
  },
  {
    model: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120b',
    provider: 'groq-120b' as const,
  },
];

/**
 * Call Groq LLM dengan fallback chain
 * Jika model 1 error (rate limit, timeout) → coba model 2
 * Jika semua Groq fail → fallback ke Gemini
 */
export async function callGroqLLM(
  messages: Message[],
  maxTokens: number = 1024,
  temperature: number = 0.7,
  systemPrompt?: string
): Promise<LLMResult> {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY tidak ditemukan di environment');
  }

  // Coba setiap model di chain
  for (let i = 0; i < GROQ_CHAIN.length; i++) {
    const modelConfig = GROQ_CHAIN[i];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12_000);
      let response: Response;

      try {
        const groqMessages = systemPrompt
          ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
          : messages;

        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages: groqMessages,
            max_tokens: maxTokens,
            temperature,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          console.warn(`Groq ${modelConfig.label} gagal (${response.status}):`, error);

          if (response.status === 429) {
            await delay(500);
            continue;
          }

          if (response.status === 503) {
            continue;
          }

          throw error;
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn(`Groq ${modelConfig.label} timeout (12s)`);
          continue;
        }
        throw fetchError;
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '';

      return {
        text,
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      console.warn(`Error Groq ${modelConfig.label}:`, error);

      // Jika ini model terakhir di Groq, throw — router memindah ke provider lain
      if (i === GROQ_CHAIN.length - 1) {
        throw new Error('Semua Groq model gagal');
      }
    }
  }

  throw new Error('Gagal call semua LLM models');
}

/**
 * Helper: delay untuk retry logic
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
