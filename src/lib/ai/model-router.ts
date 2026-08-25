import { eq, and, gte, sum } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiRuns, aiBudgetConfig, botSetting } from '@/lib/schema';
import { generateIdAiRun } from '@/lib/id-generator';
import { callGroqLLM } from '@/lib/groq';
import { getCachedData, setCachedData } from '@/lib/redis-cache';
import { generateGeminiText } from '@/lib/gemini';
import { callOpenAICompatibleProvider } from './openai-compatible';
import { sanitizeMessages } from '@/lib/ai/data-sanitizer';
import {
  getBanditConfig,
  getBanditState,
  rankProvidersByBandit,
  recordBanditOutcome,
} from '@/lib/ai/bandit';
import type { AIModelTaskConfig, AITask, AIProviderConfig, GenerateTextInput, GenerateTextResult } from './provider-types';

export const defaultProviderConfigs: AIProviderConfig[] = [
  { id: 'deterministic', name: 'deterministic', enabled: true, apiKeyEnv: '', defaultModel: 'template', supportsToolCalling: false, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 180, priority: 99 },
  { id: 'cerebras', name: 'cerebras', enabled: true, baseUrl: 'https://api.cerebras.ai/v1', apiKeyEnv: 'CEREBRAS_API_KEY', defaultModel: 'gemma-4-31b', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 260, priority: 2 },
  { id: 'groq', name: 'groq', enabled: true, apiKeyEnv: 'GROQ_API_KEY', defaultModel: 'gpt-oss-20b / gpt-oss-120b chain', supportsToolCalling: true, supportsStructuredOutput: false, supportsVision: false, maxOutputTokensDefault: 180, priority: 3 },
  { id: 'gemini', name: 'gemini', enabled: true, apiKeyEnv: 'GEMINI_API_KEY', defaultModel: 'gemini-3.5-flash-lite', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: true, maxOutputTokensDefault: 320, priority: 1 },
  { id: 'gemini3flash', name: 'gemini', enabled: true, apiKeyEnv: 'GEMINI_API_KEY', defaultModel: 'gemini-3-flash', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: true, maxOutputTokensDefault: 320, priority: 1 },
  { id: 'qwen', name: 'qwen', enabled: false, baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'QWEN_API_KEY', defaultModel: 'qwen-plus', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 220, priority: 4 },
  { id: 'ollama', name: 'ollama', enabled: false, baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', defaultModel: 'qwen3', supportsToolCalling: true, supportsStructuredOutput: true, supportsVision: false, maxOutputTokensDefault: 220, priority: 5 },
];

export const defaultTaskConfigs: AIModelTaskConfig[] = [
  { task: 'intent_detection', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 1500, maxOutputTokens: 120, temperature: 0.1, timeoutMs: 8000 },
  { task: 'structured_chat_response', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 3200, maxOutputTokens: 260, temperature: 0.15, timeoutMs: 14000 },
  { task: 'faq_answer', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 3000, maxOutputTokens: 180, temperature: 0.15, timeoutMs: 12000 },
  { task: 'memory_extraction', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 2500, maxOutputTokens: 180, temperature: 0.1, timeoutMs: 12000 },
  { task: 'admin_summary', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 4000, maxOutputTokens: 260, temperature: 0.2, timeoutMs: 14000 },
  { task: 'agentic_reasoning', primaryProviderId: 'gemini', fallbackProviderIds: ['cerebras', 'groq', 'deterministic'], maxInputTokens: 3000, maxOutputTokens: 400, temperature: 0.15, timeoutMs: 18000 },
];

const circuitBreakerState = new Map<string, { failures: number; lastFailureAt: number; cooldownUntil: number }>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 120_000;

const localPromptCache = new Map<string, { result: GenerateTextResult; cachedAt: number }>();
const PROMPT_CACHE_TTL_MS = 300_000;
const CACHE_MIN_TOKEN_LENGTH = 100;
const CACHE_MAX_CACHE_SIZE = 500;

function getCacheKey(input: GenerateTextInput): string | null {
  if (!input.systemPrompt || input.systemPrompt.length < CACHE_MIN_TOKEN_LENGTH) return null;
  const prefix = input.systemPrompt.slice(0, 200);
  const lastMsg = input.messages?.[input.messages.length - 1]?.content?.slice(0, 120) || '';
  const msgCount = input.messages?.length || 0;
  return `${input.task}|${input.temperature}|${msgCount}|${prefix}|${lastMsg}`;
}

function prunePromptCache() {
  if (localPromptCache.size <= CACHE_MAX_CACHE_SIZE) return;
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of localPromptCache.entries()) {
    if (now - entry.cachedAt > PROMPT_CACHE_TTL_MS) {
      localPromptCache.delete(key);
      removed++;
    }
  }
  if (removed === 0) {
    const oldestKey = localPromptCache.keys().next().value as string | undefined;
    if (oldestKey) localPromptCache.delete(oldestKey);
  }
}

function isCircuitOpen(providerId: string): boolean {
  const state = circuitBreakerState.get(providerId);
  if (!state) return false;
  if (state.failures < CIRCUIT_BREAKER_THRESHOLD) return false;
  if (Date.now() > state.cooldownUntil) {
    circuitBreakerState.delete(providerId);
    return false;
  }
  return true;
}

function recordFailure(providerId: string) {
  const state = circuitBreakerState.get(providerId) || { failures: 0, lastFailureAt: 0, cooldownUntil: 0 };
  state.failures++;
  state.lastFailureAt = Date.now();
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.cooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`[CIRCUIT_BREAKER] ${providerId} opened for ${CIRCUIT_BREAKER_COOLDOWN_MS}ms after ${state.failures} failures`);
  }
  circuitBreakerState.set(providerId, state);
}

function recordSuccess(providerId: string) {
  circuitBreakerState.delete(providerId);
}

async function checkBudget(providerId: string): Promise<boolean> {
  try {
    const [config] = await db.select().from(aiBudgetConfig).where(eq(aiBudgetConfig.provider, providerId)).limit(1);
    if (!config || !config.enabled || config.dailyBudgetUsd <= 0) return true;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [spent] = await db
      .select({ total: sum(aiRuns.costEstimateUsd) })
      .from(aiRuns)
      .where(and(eq(aiRuns.provider, providerId), gte(aiRuns.createdAt, todayStart.toISOString())));

    const dailySpent = Number(spent?.total || 0) / 100;
    if (dailySpent >= config.dailyBudgetUsd) {
      console.warn(`[BUDGET] ${providerId} daily budget $${config.dailyBudgetUsd} exceeded (spent: $${dailySpent})`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

// Blended per-1K USD (±85% input / 15% output), harga resmi Agustus 2026:
// gemini flash-lite $0.30/$2.50 per M; groq gpt-oss-20b $0.075/$0.30 per M.
export const ESTIMATED_COST_PER_1K_TOKENS: Record<string, number> = {
  groq: 0.00011,
  groq120: 0.00019,
  gemini: 0.00063,
  gemini3flash: 0.00063,
  cerebras: 0.0006,
  qwen: 0.0005,
};

function estimateCost(provider: string, tokensUsed: number): number {
  const rate = ESTIMATED_COST_PER_1K_TOKENS[provider] || 0.10;
  return Math.ceil((tokensUsed / 1000) * rate * 100);
}

export async function generateTextWithRouter(input: GenerateTextInput): Promise<GenerateTextResult> {
  const started = Date.now();
  const id = generateIdAiRun();
  const { providerConfigs, taskConfigs } = await loadRouterConfig();
  const taskConfig = taskConfigs.find((item) => item.task === input.task) || defaultTaskConfigs.find((item) => item.task === input.task);
  const baseProviderOrder = taskConfig ? [taskConfig.primaryProviderId, ...taskConfig.fallbackProviderIds] : ['groq', 'gemini', 'deterministic'];
  const providerOrder = await rankProvidersByTask(input.task, baseProviderOrder);
  const maxTokens = input.maxTokens || taskConfig?.maxOutputTokens || 180;
  const temperature = input.temperature ?? taskConfig?.temperature ?? 0.2;

  const sanitizedMessages = sanitizeMessages(input.messages);

  const cacheKey = getCacheKey(input);
  if (cacheKey) {
    const localCached = localPromptCache.get(cacheKey);
    if (localCached && Date.now() - localCached.cachedAt < PROMPT_CACHE_TTL_MS) {
      return localCached.result;
    }
    const redisCached = await getCachedData<GenerateTextResult>(`prompt:${cacheKey}`);
    if (redisCached) {
      localPromptCache.set(cacheKey, { result: redisCached, cachedAt: Date.now() });
      prunePromptCache();
      return redisCached;
    }
  }

  for (const providerId of providerOrder) {
    const provider = providerConfigs.find((item) => item.id === providerId || item.name === providerId);
    if (!provider?.enabled) continue;
    if (isCircuitOpen(providerId)) {
      console.warn(`[CIRCUIT_BREAKER] Skipping ${providerId} (circuit open)`);
      continue;
    }
    if (provider.name !== 'deterministic' && provider.apiKeyEnv && !process.env[provider.apiKeyEnv]) continue;
    if (provider.name !== 'deterministic' && !(await checkBudget(providerId))) {
      console.warn(`[BUDGET] Skipping ${providerId} (budget exhausted)`);
      continue;
    }
    const attemptStarted = Date.now();
    try {
      if (provider.name === 'groq') {
        const result = await callGroqLLM(sanitizedMessages, maxTokens, temperature, input.systemPrompt);
        const routed = { text: result.text, provider: result.provider, model: result.model || provider.defaultModel, tokensUsed: result.tokensUsed };
        await logRun(id, input, routed, Date.now() - started, 'success');
        recordSuccess(providerId);
        recordBandit(input.task, providerId, true, 'success', Date.now() - attemptStarted, providerOrder);
        if (cacheKey) {
          localPromptCache.set(cacheKey, { result: routed, cachedAt: Date.now() });
          prunePromptCache();
          setCachedData(`prompt:${cacheKey}`, routed, 300).catch(() => {});
        }
        return routed;
      }
      if (provider.name === 'gemini') {
        const routed = await generateGeminiText(sanitizedMessages, maxTokens, temperature, input.systemPrompt, provider.defaultModel || 'gemini-3.5-flash-lite');
        await logRun(id, input, routed, Date.now() - started, 'success');
        recordSuccess(providerId);
        recordBandit(input.task, providerId, true, 'success', Date.now() - attemptStarted, providerOrder);
        if (cacheKey) {
          localPromptCache.set(cacheKey, { result: routed, cachedAt: Date.now() });
          prunePromptCache();
          setCachedData(`prompt:${cacheKey}`, routed, 300).catch(() => {});
        }
        return routed;
      }
      if (provider.name === 'cerebras' || provider.name === 'qwen') {
        const routed = await callOpenAICompatibleProvider(provider, { ...input, messages: sanitizedMessages }, maxTokens, temperature);
        await logRun(id, input, routed, Date.now() - started, 'success');
        recordSuccess(providerId);
        recordBandit(input.task, providerId, true, 'success', Date.now() - attemptStarted, providerOrder);
        return routed;
      }
      if (provider.name === 'deterministic') {
        const result = { text: 'Aku siap bantu pilih produk dan proses pesanan lewat chat ini.', provider: 'deterministic', model: 'template' };
        await logRun(id, input, result, Date.now() - started, 'fallback');
        return result;
      }
    } catch (error) {
      recordFailure(providerId);
      recordBandit(input.task, providerId, false, 'error', Date.now() - attemptStarted, providerOrder);
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
      providerConfigs: normalizeProviderConfigs(providerRow?.value_json ? JSON.parse(providerRow.value_json) as AIProviderConfig[] : defaultProviderConfigs),
      taskConfigs: normalizeTaskConfigs(taskRow?.value_json ? JSON.parse(taskRow.value_json) as AIModelTaskConfig[] : defaultTaskConfigs),
    };
  } catch {
    return { providerConfigs: defaultProviderConfigs, taskConfigs: defaultTaskConfigs };
  }
}

export function normalizeProviderConfigs(configs: AIProviderConfig[]) {
  const byId = new Map(configs.map((item) => [item.id, item]));
  return defaultProviderConfigs.map((fallback) => {
    const current = byId.get(fallback.id);
    return current
      ? {
          ...fallback,
          ...current,
          defaultModel:
            current.id === 'cerebras' && (!current.defaultModel || current.defaultModel === 'gemma-4-31b')
              ? fallback.defaultModel
              : current.defaultModel || fallback.defaultModel,
        }
      : fallback;
  });
}

export function normalizeTaskConfigs(configs: AIModelTaskConfig[]) {
  const byTask = new Map(configs.map((item) => [item.task, item]));
  return defaultTaskConfigs.map((fallback) => {
    const current = byTask.get(fallback.task);
    return current ? { ...fallback, ...current } : fallback;
  });
}

async function logRun(id: string, input: GenerateTextInput, result: GenerateTextResult, latencyMs: number, status: 'success' | 'error' | 'fallback', errorMessage?: string) {
  try {
    const tokensUsed = result.tokensUsed || 0;
    const costEstimate = estimateCost(String(result.provider), tokensUsed);
    await db.insert(aiRuns).values({
      id,
      chatSessionId: input.chatSessionId || null,
      task: input.task,
      provider: String(result.provider),
      model: result.model,
      inputTokens: 0,
      outputTokens: tokensUsed,
      costEstimateUsd: costEstimate,
      latencyMs,
      status,
      errorMessage: errorMessage || null,
    });
  } catch {
    // AI logging must never break chat.
  }
}

/**
 * RL — urutkan provider untuk sebuah task: bandit Thompson sampling jika
 * ada state, fallback ke hierarki statis jika GAGAL baca state. Selalu
 * mempertahankan 'deterministic' di urutan paling akhir sebagai jaring
 * pengaman, sehingga fallback manual admin TIDAK diacak.
 */
async function rankProvidersByTask(task: AITask, baseOrder: string[]): Promise<string[]> {
  try {
    const config = await getBanditConfig();
    if (!config.enabled || baseOrder.length <= 1) return baseOrder;

    const state = await getBanditState();
    // Mulai dari hierarki statis (primary/fallback admin) lalu biarkan bandit
    // menggeser di antara provider nyata. Deterministic selalu di akhir.
    const ranked = rankProvidersByBandit(task, baseOrder, state, config);

    const detAt = ranked.indexOf('deterministic');
    if (detAt >= 0 && detAt !== ranked.length - 1) {
      const withoutDet = ranked.filter((p) => p !== 'deterministic');
      withoutDet.push('deterministic');
      return withoutDet;
    }
    return ranked;
  } catch {
    return baseOrder;
  }
}

/** RL — fire-and-forget pencatatan hasil satu attempt ke bandit. */
function recordBandit(task: AITask, provider: string, success: boolean, status: 'success' | 'error' | 'fallback', latencyMs: number, candidates: string[]) {
  recordBanditOutcome({
    task,
    provider,
    success,
    status,
    latencyMs,
    candidateProviders: candidates,
  }).catch(() => {
    // bandit must never break chat
  });
}
