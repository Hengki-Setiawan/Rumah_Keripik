/**
 * Gemini Embedding Client
 * Untuk generate vector embeddings untuk RAG Knowledge Base
 * Model: gemini-embedding-001 (3072 dimensi)
 */

const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 3072; // F32, dari Gemini embedding-001
const DEFAULT_TEXT_MODEL = 'gemini-2.0-flash';

interface EmbeddingResult {
  embedding: number[];
  tokensUsed?: number;
}

type GeminiChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type GeminiTextResult = {
  text: string;
  provider: 'gemini';
  model: string;
  tokensUsed?: number;
};

export async function generateGeminiText(
  messages: GeminiChatMessage[],
  maxTokens: number = 220,
  temperature: number = 0.2,
  systemPrompt?: string,
  model: string = DEFAULT_TEXT_MODEL
): Promise<GeminiTextResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY tidak ditemukan di environment');

  const mergedSystemPrompt = [
    systemPrompt,
    ...messages.filter((message) => message.role === 'system').map((message) => message.content),
  ].filter(Boolean).join('\n\n');

  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(mergedSystemPrompt ? { system_instruction: { parts: [{ text: mergedSystemPrompt }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini gagal (${response.status}): ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '',
    provider: 'gemini',
    model,
    tokensUsed: data.usageMetadata?.totalTokenCount,
  };
}

/**
 * Generate embedding untuk teks Knowledge Base
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY tidak ditemukan di environment');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text untuk embedding tidak boleh kosong');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/${EMBEDDING_MODEL}:embedContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          content: {
            parts: [
              {
                text: text,
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Gemini Embedding Error:', error);
      throw new Error(`Gemini API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values || [];

    if (!embedding || embedding.length === 0) {
      throw new Error('Embedding tidak dikembalikan dari Gemini API');
    }

    return {
      embedding,
      tokensUsed: data.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embedding untuk query
 * Menggunakan taskType RETRIEVAL_QUERY untuk optimasi retrieval
 */
export async function generateQueryEmbedding(text: string): Promise<EmbeddingResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY tidak ditemukan di environment');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/${EMBEDDING_MODEL}:embedContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_QUERY',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API Error: ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values || [];

    return { embedding, tokensUsed: data.usageMetadata?.totalTokenCount };
  } catch (error) {
    console.error('❌ Error generating query embedding:', error);
    throw error;
  }
}

/**
 * Convert number[] ke format vector string untuk Turso query
 * Input: [0.1, 0.2, 0.3, ...]
 * Output: "[0.1, 0.2, 0.3, ...]" (string)
 */
export function toTursoVectorString(embedding: number[]): string {
  return '[' + embedding.join(',') + ']';
}

/**
 * Convert Uint8Array (binary embedding) ke Float32Array
 * Digunakan jika Gemini mengembalikan embedding dalam format biner
 */
export function uint8ToFloat32(buffer: Uint8Array): number[] {
  const float32Array = new Float32Array(buffer.buffer);
  return Array.from(float32Array);
}

/**
 * Hitung cosine similarity antara dua embedding
 * Untuk testing vector search sebelum disimpan ke Turso
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector harus memiliki dimensi yang sama');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
