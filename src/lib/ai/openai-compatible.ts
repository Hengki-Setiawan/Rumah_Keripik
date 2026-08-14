import type { AIProviderConfig, GenerateTextInput, GenerateTextResult } from './provider-types';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function callOpenAICompatibleProvider(provider: AIProviderConfig, input: GenerateTextInput, maxTokens: number, temperature: number): Promise<GenerateTextResult> {
  const isLocal = isLocalEndpoint(provider.baseUrl);
  const apiKey = provider.apiKeyEnv && !isLocal ? process.env[provider.apiKeyEnv] : undefined;
  if (!provider.baseUrl) throw new Error(`${provider.id} baseUrl belum dikonfigurasi`);
  if (!apiKey && !isLocal) throw new Error(`${provider.apiKeyEnv} tidak ditemukan di environment`);
  const resolvedModel = resolveProviderModel(provider);

  const messages: ChatMessage[] = input.systemPrompt
    ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
    : input.messages;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isLocal) headers.Authorization = `Bearer ${apiKey || 'ollama'}`;
  else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: resolvedModel, messages, max_tokens: maxTokens, temperature }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${provider.id} gagal (${response.status}): ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    provider: provider.name,
    model: resolvedModel,
    tokensUsed: data.usage?.total_tokens,
  };
}

function isLocalEndpoint(baseUrl?: string) {
  return !!baseUrl && /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(baseUrl);
}

function resolveProviderModel(provider: AIProviderConfig) {
  if (provider.name === 'cerebras') {
    return process.env.CEREBRAS_MODEL || provider.defaultModel || 'qwen-3-32b';
  }
  if (provider.name === 'qwen') {
    return process.env.QWEN_MODEL || provider.defaultModel || 'qwen-plus';
  }
  if (provider.name === 'ollama') {
    return process.env.OLLAMA_MODEL || provider.defaultModel || 'qwen3';
  }
  return provider.defaultModel;
}
