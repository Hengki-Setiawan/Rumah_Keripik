import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { callGroqLLM } from '@/lib/groq';
import { generateGeminiText } from '@/lib/gemini';
import { callOpenAICompatibleProvider } from '@/lib/ai/openai-compatible';
import { loadRouterConfig } from '@/lib/ai/model-router';
import type { AIProviderConfig, GenerateTextInput } from '@/lib/ai/provider-types';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { providerConfigs } = await loadRouterConfig();
  const checks = await Promise.all(providerConfigs.map(async (provider) => {
    const hasKey = !provider.apiKeyEnv || Boolean(process.env[provider.apiKeyEnv]);
    const enabled = provider.enabled;
    if (!enabled || !hasKey) return { provider: provider.name, model: provider.defaultModel, enabled, hasKey, ok: provider.name === 'deterministic', latencyMs: 0, status: enabled ? 'missing_key' : 'disabled' };

    const started = Date.now();
    try {
      const result = await runDirectProviderHealthCheck(provider);
      return { provider: provider.name, model: result.model, enabled, hasKey, ok: Boolean(result.text), latencyMs: Date.now() - started, status: 'ok' };
    } catch (error) {
      return { provider: provider.name, model: provider.defaultModel, enabled, hasKey, ok: false, latencyMs: Date.now() - started, status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  }));

  return NextResponse.json({ ok: checks.some((check) => check.ok), checks });
}

async function runDirectProviderHealthCheck(provider: AIProviderConfig) {
  if (provider.name === 'deterministic') {
    return { text: 'OK', provider: 'deterministic', model: provider.defaultModel };
  }

  const input: GenerateTextInput = {
    task: 'faq_answer',
    systemPrompt: 'Jawab hanya kata OK.',
    messages: [{ role: 'user', content: 'health check' }],
    maxTokens: 8,
    temperature: 0,
  };

  if (provider.name === 'groq') {
    const result = await callGroqLLM(input.messages, input.maxTokens || 8, input.temperature || 0, input.systemPrompt);
    return { text: result.text, provider: result.provider, model: result.model || provider.defaultModel, tokensUsed: result.tokensUsed };
  }

  if (provider.name === 'gemini') {
    return generateGeminiText(input.messages, input.maxTokens || 8, input.temperature || 0, input.systemPrompt, provider.defaultModel || 'gemini-2.0-flash');
  }

  return callOpenAICompatibleProvider(provider, input, input.maxTokens || 8, input.temperature || 0);
}
