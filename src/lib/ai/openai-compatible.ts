import type { AIProviderConfig, GenerateTextInput, GenerateTextResult } from './provider-types';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function callOpenAICompatibleProvider(provider: AIProviderConfig, input: GenerateTextInput, maxTokens: number, temperature: number): Promise<GenerateTextResult> {
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined;
  if (!provider.baseUrl) throw new Error(`${provider.id} baseUrl belum dikonfigurasi`);
  if (!apiKey) throw new Error(`${provider.apiKeyEnv} tidak ditemukan di environment`);
  const resolvedModel = resolveProviderModel(provider);

  const messages: ChatMessage[] = input.systemPrompt
    ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
    : input.messages;

  const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

function resolveProviderModel(provider: AIProviderConfig) {
  if (provider.name === 'cerebras') {
    return process.env.CEREBRAS_MODEL || provider.defaultModel || 'gemma-4-31b';
  }
  if (provider.name === 'qwen') {
    return process.env.QWEN_MODEL || provider.defaultModel || 'qwen-plus';
  }
  return provider.defaultModel;
}
