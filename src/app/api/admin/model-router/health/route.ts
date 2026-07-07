import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { defaultProviderConfigs, generateTextWithRouter } from '@/lib/ai/model-router';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const checks = await Promise.all(defaultProviderConfigs.map(async (provider) => {
    const hasKey = !provider.apiKeyEnv || Boolean(process.env[provider.apiKeyEnv]);
    const enabled = provider.enabled;
    if (!enabled || !hasKey) return { provider: provider.name, model: provider.defaultModel, enabled, hasKey, ok: provider.name === 'deterministic', latencyMs: 0, status: enabled ? 'missing_key' : 'disabled' };

    const started = Date.now();
    try {
      const result = await generateTextWithRouter({
        task: 'faq_answer',
        systemPrompt: `Jawab hanya kata OK. Gunakan provider ${provider.name} jika router memilihnya.`,
        messages: [{ role: 'user', content: 'health check' }],
        maxTokens: 8,
        temperature: 0,
      });
      return { provider: provider.name, model: result.model, enabled, hasKey, ok: Boolean(result.text), latencyMs: Date.now() - started, status: result.provider === 'deterministic' && provider.name !== 'deterministic' ? 'router_fallback' : 'ok' };
    } catch (error) {
      return { provider: provider.name, model: provider.defaultModel, enabled, hasKey, ok: false, latencyMs: Date.now() - started, status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  }));

  return NextResponse.json({ ok: checks.some((check) => check.ok), checks });
}
