import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiRuns, botSetting } from '@/lib/schema';
import { generateIdAiRun } from '@/lib/id-generator';
import { callGroqLLM } from '@/lib/groq';
import { generateGeminiText } from '@/lib/gemini';
import { callOpenAICompatibleProvider } from './openai-compatible';
import type { AIModelTaskConfig, AIProviderConfig, GenerateTextInput, GenerateTextResult } from './provider-types';

export const defaultProviderConfigs: AIProviderConfig[] = [
  { id: 'deterministic', name: 'deterministic', enabled: true, apiKeyEnv: '', defaultModel: 'template', supportsToolCalling: false, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 180, priority: 99 },
  { id: 'gemini', name: 'gemini', enabled: true, apiKeyEnv: 'GEMINI_API_KEY', defaultModel: 'gemini-2.0-flash', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: true, maxOutputTokensDefault: 320, priority: 1 },
  { id: 'cerebras', name: 'cerebras', enabled: true, baseUrl: 'https://api.cerebras.ai/v1', apiKeyEnv: 'CEREBRAS_API_KEY', defaultModel: 'qwen-3-32b', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 260, priority: 2 },
  { id: 'groq', name: 'groq', enabled: true, apiKeyEnv: 'GROQ_API_KEY', defaultModel: 'llama-3.3/3.1 fallback chain', supportsToolCalling: true, supportsStructuredOutput: false, supportsVision: false, maxOutputTokensDefault: 180, priority: 3 },
  { id: 'qwen', name: 'qwen', enabled: false, baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'QWEN_API_KEY', defaultModel: 'qwen-plus', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 220, priority: 4 },
];

export const defaultTaskConfigs: AIModelTaskConfig[] = [
  { task: 'intent_detection', primaryProviderId: 'groq', fallbackProviderIds: ['cerebras', 'gemini', 'deterministic'], maxInputTokens: 1500, maxOutputTokens: 120, temperature: 0.1, timeoutMs: 8000 },
  { task: 'structured_chat_response', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 3200, maxOutputTokens: 260, temperature: 0.15, timeoutMs: 14000 },
  { task: 'faq_answer', primaryProviderId: 'cerebras', fallbackProviderIds: ['gemini', 'groq', 'deterministic'], maxInputTokens: 3000, maxOutputTokens: 180, temperature: 0.15, timeoutMs: 12000 },
  { task: 'memory_extraction', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 2500, maxOutputTokens: 180, temperature: 0.1, timeoutMs: 12000 },
  { task: 'admin_summary', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 4000, maxOutputTokens: 260, temperature: 0.2, timeoutMs: 14000 },
];

export async function generateTextWithRouter(input: GenerateTextInput): Promise<GenerateTextResult> {
  const started = Date.now();
  const id = generateIdAiRun();
  const { providerConfigs, taskConfigs } = await loadRouterConfig();
  const taskConfig = taskConfigs.find((item) => item.task === input.task) || defaultTaskConfigs.find((item) => item.task === input.task);
  const providerOrder = taskConfig ? [taskConfig.primaryProviderId, ...taskConfig.fallbackProviderIds] : ['groq', 'gemini', 'deterministic'];
  const maxTokens = input.maxTokens || taskConfig?.maxOutputTokens || 180;
  const temperature = input.temperature ?? taskConfig?.temperature ?? 0.2;

  for (const providerId of providerOrder) {
    const provider = providerConfigs.find((item) => item.id === providerId || item.name === providerId);
    if (!provider?.enabled) continue;
    if (provider.name !== 'deterministic' && provider.apiKeyEnv && !process.env[provider.apiKeyEnv]) continue;
    try {
      if (provider.name === 'groq') {
        const result = await callGroqLLM(input.messages, maxTokens, temperature, input.systemPrompt);
        const routed = { text: result.text, provider: result.provider, model: result.model || provider.defaultModel, tokensUsed: result.tokensUsed };
        await logRun(id, input, routed, Date.now() - started, 'success');
        return routed;
      }
      if (provider.name === 'gemini') {
        const routed = await generateGeminiText(input.messages, maxTokens, temperature, input.systemPrompt, provider.defaultModel || 'gemini-2.0-flash');
        await logRun(id, input, routed, Date.now() - started, 'success');
        return routed;
      }
      if (provider.name === 'cerebras' || provider.name === 'qwen') {
        const routed = await callOpenAICompatibleProvider(provider, input, maxTokens, temperature);
        await logRun(id, input, routed, Date.now() - started, 'success');
        return routed;
      }
      if (provider.name === 'deterministic') {
        const result = { text: 'Aku siap bantu pilih produk dan proses pesanan lewat chat ini.', provider: 'deterministic', model: 'template' };
        await logRun(id, input, result, Date.now() - started, 'fallback');
        return result;
      }
    } catch (error) {
      await logRun(id, input, { text: '', provider: provider.name, model: provider.defaultModel }, Date.now() - started, 'error', error instanceof Error ? error.message : 'AI provider error');
    }
  }

  const fallback = { text: 'Maaf kak, asisten sedang terbatas. Aku tampilkan pilihan yang aman dulu ya.', provider: 'deterministic', model: 'fallback-template' };
  await logRun(id, input, fallback, Date.now() - started, 'fallback', 'No enabled provider succeeded');
  return fallback;
}

export async function loadRouterConfig() {
  try {
    const [providerRow] = await db.select().from(botSetting).where(eq(botSetting.key, 'ai.provider.configs')).limit(1);
    const [taskRow] = await db.select().from(botSetting).where(eq(botSetting.key, 'ai.task.configs')).limit(1);
    return {
      providerConfigs: providerRow?.value_json ? JSON.parse(providerRow.value_json) as AIProviderConfig[] : defaultProviderConfigs,
      taskConfigs: taskRow?.value_json ? JSON.parse(taskRow.value_json) as AIModelTaskConfig[] : defaultTaskConfigs,
    };
  } catch {
    return { providerConfigs: defaultProviderConfigs, taskConfigs: defaultTaskConfigs };
  }
}

async function logRun(id: string, input: GenerateTextInput, result: GenerateTextResult, latencyMs: number, status: 'success' | 'error' | 'fallback', errorMessage?: string) {
  try {
    await db.insert(aiRuns).values({
      id,
      chatSessionId: input.chatSessionId || null,
      task: input.task,
      provider: String(result.provider),
      model: result.model,
      inputTokens: 0,
      outputTokens: result.tokensUsed || 0,
      latencyMs,
      status,
      errorMessage: errorMessage || null,
    });
  } catch {
    // AI logging must never break chat.
  }
}
