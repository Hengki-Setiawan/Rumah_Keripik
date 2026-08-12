import { eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiRuns, botSetting } from '@/lib/schema';

/**
 * Reinforcement Learning — Contextual Bandit untuk Model Router.
 *
 * Pendekatan: Thompson sampling (Beta-Bernoulli dengan reward kontinu).
 * Setiap (task, provider) adalah satu "lengan" (arm). Setiap request = satu
 * "pull". Reward r ∈ [0,1] dihitung dari composite: kesuksesan + kecepatan +
 * biaya, lalu posterior Beta diperbarui (alpha += r, beta += 1 - r).
 *
 * Pilihan untuk request berikutnya diambil dengan sampling posterior
 * (exploit) dengan sedikit epsilon-greedy (explore). Tanpa neural net —
 * konvergen cepat, revisit-safe, dan bisa dijelaskan untuk skripsi.
 *
 * State disimpan di tabel `bot_setting` (key `ai.bandit.state`) → tanpa
 * migrasi schema. Kalau key kosong, posterior di-bootstrap dari riwayat
 * `ai_runs` 30 hari terakhir.
 */

const STATE_KEY = 'ai.bandit.state';
const CONFIG_KEY = 'ai.bandit.config';
const BOOTSTRAP_DAYS = 30;
const UNKNOWN_LATENCY_PENALTY = 0.5;
// Decay (non-stationary): evidensi yang lebih tua dari half-life ini dilipat
// separuh menuju prior uniform. Menjaga bandit tetap adaptif saat kualitas
// provider berubah (quota reset, degradasi layanan, model baru).
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
// Tie-breaker: saat dua arm berselisih tipis, pilih yang berpengalaman
// (lebih banyak pulls) — stabilkan keputusan (OrcaRouter: pick-flip 16.7→2.4%).
const TIE_BREAK_MARGIN = 0.03;

// MUTEX: serialize read-modify-write state bandit. Karena seluruh state hidup
// di SATU baris bot_setting, dua request bersamaan bisa saling timpa (lost
// update). Antrikan update in-process saja — cukup untuk 1 instance Next.js.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => {});
  return next;
}

export interface BanditArmStats {
  alpha: number;
  beta: number;
  pulls: number;
  rewardSum: number;
  latencyEmaMs: number;
  successCount: number;
  lastPullAt?: number;
}

export type BanditState = Record<string, Record<string, BanditArmStats>>; // task -> provider -> stats

export interface BanditConfig {
  enabled: boolean;
  epsilon: number;
  weights: { success: number; latency: number; cost: number };
  minPullsBeforeExploit: number;
}

export const defaultBanditConfig: BanditConfig = {
  enabled: true,
  epsilon: 0.1,
  weights: { success: 0.6, latency: 0.2, cost: 0.2 },
  minPullsBeforeExploit: 3,
};

export const BANDIT_EXCLUDED_PROVIDERS = new Set(['deterministic']);

const COST_PER_1K: Record<string, number> = {
  groq: 0.05,
  gemini: 0.3,
  cerebras: 0.08,
  qwen: 0.08,
};

function random(): number {
  return Math.random();
}

/** Sampling dari distribusi Beta(alpha, beta) via transformasi Gamma. */
export function sampleBeta(alpha: number, beta: number): number {
  const a = alpha <= 0 ? 1 : alpha;
  const b = beta <= 0 ? 1 : beta;
  // Beta = X/(X+Y) dengan X~Gamma(a), Y~Gamma(b) — masing-masing di-sample SEKALI.
  const x = gammaSample(a, 1);
  const y = gammaSample(b, 1);
  const value = x / (x + y);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function gammaSample(shape: number, scale: number): number {
  // Marsaglia & Tsang untuk shape >= 1; fallback sum-of-exponentials jika < 1.
  if (shape < 1) {
    let s = 0;
    const n = Math.ceil(shape);
    for (let i = 0; i < n; i++) s += -Math.log(Math.max(1e-12, random()));
    return s * scale;
  }
  // Marsaglia-Tsang
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 64; i++) {
    const v = gaussSample();
    const x = 1 + c * v;
    if (x <= 0) continue;
    const u = random();
    const candidates = [
      Math.log(u),
      0.5 * v * v + d * Math.log(x) - d * x + d,
    ];
    if (u > 1 - 1e-12) continue;
    if (candidates[0] <= candidates[1]) return d * x * scale;
  }
  return d * scale;
}

function gaussSample(): number {
  let u = 0;
  let v = 0;
  for (let i = 0; i < 64; i++) {
    u = random();
    v = random();
    const s = u * u + v * v;
    if (s > 0 && s <= 1) return u * Math.sqrt((-2 * Math.log(s)) / s);
  }
  return 0;
}

export function armExpectedReward(stats: BanditArmStats): number {
  const { alpha, beta, pulls } = stats;
  if (pulls <= 0) return 0.5;
  return alpha / (alpha + beta);
}

export function armRewardStd(stats: BanditArmStats): number {
  const { alpha, beta, pulls } = stats;
  if (pulls <= 0) return 0.5;
  const s = alpha + beta;
  return Math.sqrt((alpha * beta) / (s * s * (s + 1)));
}

/** Reward composite dari satu hasil run LLM. */
export function computeReward(input: {
  success: boolean;
  status: 'success' | 'error' | 'fallback';
  latencyMs: number;
  latencyTargetMs: number;
  provider: string;
  candidateProviders: string[];
  config?: Pick<BanditConfig, 'weights'>;
}): number {
  const weights = input.config?.weights ?? defaultBanditConfig.weights;

  let successScore = 0;
  if (input.status === 'success') successScore = 1;
  else if (input.status === 'fallback') successScore = 0.2;
  else if (input.success) successScore = 0.9;
  // error -> 0

  let latencyScore = 0.5;
  if (input.latencyMs > 0 && input.latencyTargetMs > 0) {
    const ratio = input.latencyMs / input.latencyTargetMs;
    latencyScore = Math.max(0, Math.min(1, 1 - ratio));
  } else if (input.latencyMs <= 0) {
    latencyScore = UNKNOWN_LATENCY_PENALTY;
  }

  let costScore = 0.5;
  const candidates = (input.candidateProviders.length ? input.candidateProviders : [input.provider]).filter(
    (p) => !BANDIT_EXCLUDED_PROVIDERS.has(p),
  );
  const rates = candidates.map((p) => COST_PER_1K[p] ?? 0.1);
  const minRate = Math.min(...rates);
  const rate = COST_PER_1K[input.provider] ?? 0.1;
  if (minRate > 0) costScore = Math.max(0, Math.min(1, minRate / rate));

  return Math.min(
    1,
    Math.max(0, weights.success * successScore + weights.latency * latencyScore + weights.cost * costScore),
  );
}

// ─── Persistence (bot_setting) ─────────────────────────────────────────────

async function upsertSetting(key: string, valueJson: string) {
  const [existing] = await db.select().from(botSetting).where(eq(botSetting.key, key)).limit(1);
  const now = sql`(datetime('now', 'utc'))`;
  if (existing) {
    await db.update(botSetting).set({ value_json: valueJson, updated_at: now }).where(eq(botSetting.key, key));
  } else {
    await db.insert(botSetting).values({ key, value_json: valueJson, updated_by: 'bandit' });
  }
}

export async function getBanditConfig(): Promise<BanditConfig> {
  try {
    const [row] = await db.select().from(botSetting).where(eq(botSetting.key, CONFIG_KEY)).limit(1);
    if (!row?.value_json) return defaultBanditConfig;
    const parsed = safeJson<Partial<BanditConfig>>(row.value_json, {});
    return {
      ...defaultBanditConfig,
      ...parsed,
      weights: { ...defaultBanditConfig.weights, ...(parsed.weights ?? {}) },
    };
  } catch {
    return defaultBanditConfig;
  }
}

export async function setBanditConfig(config: Partial<BanditConfig>): Promise<BanditConfig> {
  const merged: BanditConfig = {
    ...defaultBanditConfig,
    ...config,
    weights: { ...defaultBanditConfig.weights, ...(config.weights ?? {}) },
  };
  await upsertSetting(CONFIG_KEY, JSON.stringify(merged));
  return merged;
}

function normalizeState(raw: unknown): BanditState {
  if (!raw || typeof raw !== 'object') return {};
  const out: BanditState = {};
  for (const [task, arms] of Object.entries(raw as Record<string, unknown>)) {
    if (!arms || typeof arms !== 'object') continue;
    out[task] = {};
    for (const [provider, stats] of Object.entries(arms as Record<string, unknown>)) {
      const s = stats as Partial<BanditArmStats>;
      out[task][provider] = {
        alpha: Number(s.alpha ?? 1),
        beta: Number(s.beta ?? 1),
        pulls: Number(s.pulls ?? 0),
        rewardSum: Number(s.rewardSum ?? 0),
        latencyEmaMs: Number(s.latencyEmaMs ?? 0),
        successCount: Number(s.successCount ?? 0),
        lastPullAt: s.lastPullAt != null ? Number(s.lastPullAt) : undefined,
      };
      out[task][provider] = applyArmDecay(out[task][provider]);
    }
  }
  return out;
}

export async function getBanditState(): Promise<BanditState> {
  try {
    const [row] = await db.select().from(botSetting).where(eq(botSetting.key, STATE_KEY)).limit(1);
    if (row?.value_json) return normalizeState(safeJson(row.value_json, {}));
  } catch {
    // fall through ke bootstrap
  }
  // State kosong → bootstrap dari riwayat. Persist hasilnya supaya request
  // berikutnya tidak re-query agregat ai_runs di tiap ranking.
  const bootstrapped = await bootstrapFromRuns();
  if (Object.keys(bootstrapped).length > 0) {
    await upsertSetting(STATE_KEY, JSON.stringify(bootstrapped)).catch(() => {});
  }
  return bootstrapped;
}

async function persistBanditState(state: BanditState) {
  await upsertSetting(STATE_KEY, JSON.stringify(state));
}

/**
 * Bootstrap posterior dari riwayat ai_runs (30 hari) per (task, provider).
 * Dipakai saat state belum tersimpan agar pilihan awal tidak buta.
 */
export async function bootstrapFromRuns(): Promise<BanditState> {
  try {
    const since = new Date(Date.now() - BOOTSTRAP_DAYS * 86400000).toISOString();
    const rows = await db
      .select({
        task: aiRuns.task,
        provider: aiRuns.provider,
        status: aiRuns.status,
        latencyMs: aiRuns.latencyMs,
        tokens: aiRuns.outputTokens,
        count: sql<number>`COUNT(*)`,
      })
      .from(aiRuns)
      .where(gte(aiRuns.createdAt, since))
      .groupBy(aiRuns.task, aiRuns.provider, aiRuns.status)
      .orderBy(sql`MIN(${aiRuns.createdAt}) DESC`);

    const state: BanditState = {};
    for (const row of rows) {
      if (BANDIT_EXCLUDED_PROVIDERS.has(row.provider)) continue;
      const latencyTarget = inferLatencyTarget(row.task);
      const success = row.status === 'success';
      const reward = computeReward({
        success,
        status: row.status,
        latencyMs: Number(row.latencyMs ?? 0),
        latencyTargetMs: latencyTarget,
        provider: row.provider,
        candidateProviders: [row.provider],
      });
      const count = Number(row.count ?? 1);
      const arm = (state[row.task] ??= {});
      const stats = (arm[row.provider] ??= emptyArm());
      stats.pulls += count;
      stats.rewardSum += reward * count;
      stats.successCount += success ? count : 0;
      stats.alpha = stats.rewardSum + 1;
      stats.beta = stats.pulls - stats.rewardSum + 1;
      stats.lastPullAt = Date.now(); // bootstrap dianggap segar
      if (Number(row.latencyMs) > 0) {
        const latency = Number(row.latencyMs);
        stats.latencyEmaMs = stats.latencyEmaMs === 0 ? latency : stats.latencyEmaMs * 0.8 + latency * 0.2;
      }
    }
    return state;
  } catch {
    return {};
  }
}

function emptyArm(): BanditArmStats {
  return { alpha: 1, beta: 1, pulls: 0, rewardSum: 0, latencyEmaMs: 0, successCount: 0 };
}

/**
 * Non-stationary decay: liat seberapa lama evidensi terakhir dipull, lalu
 * kerutkan (alpha, beta) menuju prior uniform (1,1) eksponensial.
 * Mati total setelah beberapa half-life → bandit "lupa" dan bisa coba lagi.
 */
export function applyArmDecay(stats: BanditArmStats): BanditArmStats {
  if (!stats.lastPullAt || stats.pulls <= 0) return stats;
  const ageMs = Date.now() - stats.lastPullAt;
  if (ageMs <= 0) return stats;
  const w = Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS);
  if (w >= 0.99) return stats;
  const alpha = 1 + w * (stats.alpha - 1);
  const beta = 1 + w * (stats.beta - 1);
  return { ...stats, alpha, beta };
}

function inferLatencyTarget(task: string): number {
  const map: Record<string, number> = {
    intent_detection: 8000,
    structured_chat_response: 14000,
    faq_answer: 12000,
    memory_extraction: 12000,
    admin_summary: 14000,
    agentic_reasoning: 18000,
    product_recommendation: 12000,
    conversation_summary: 12000,
    image_or_payment_receipt_analysis: 16000,
  };
  return map[task] ?? 12000;
}

// ─── Decision ─────────────────────────────────────────────────────────────

/**
 * Urutkan kandidat provider untuk suatu task berdasarkan Thompson sampling.
 * - Eksplorasi: dengan probabilitas epsilon, pilih lengan acak.
 * - Eksploitasi: pilih lengan dengan sample posterior tertinggi.
 * - Lengan tanpa data sama sekali tetap dipertimbangkan (posterior uniform),
 *   tapi diberi prior uji dini lewat minPulls threshold di ranker.
 * Mengembalikan array yang sudah diurut; provider yang tak punya arm
 * ditempatkan di belakang dengan prioritas random.
 */
export function rankProvidersByBandit(
  task: string,
  providers: string[],
  state: BanditState,
  config: BanditConfig = defaultBanditConfig,
): string[] {
  const filtered = providers.filter((p) => !BANDIT_EXCLUDED_PROVIDERS.has(p));
  if (filtered.length <= 1) return providers;

  const arms = state[task] ?? {};
  const withData: Array<{ provider: string; sample: number; pulls: number }> = [];
  const withoutData: string[] = [];

  for (const provider of filtered) {
    const stats = arms[provider];
    if (stats && stats.pulls >= config.minPullsBeforeExploit) {
      withData.push({ provider, sample: sampleBeta(stats.alpha, stats.beta), pulls: stats.pulls });
    } else {
      withoutData.push(provider);
    }
  }

  // 1 - epsilon: exploit (sample tertinggi). epsilon: explore.
  // Explore memilih acak dari SELURUH kandidat (termasuk arm dingin tanpa
  // data) supaya lengan baru tetap pernah dicoba — mencegah starvation.
  if (Math.random() < config.epsilon) {
    const explorePool = filtered; // semua provider nyata, dingin + hangat
    const pick = explorePool[Math.floor(random() * explorePool.length)];
    const exploitedPicks = withData
      .filter((x) => x.provider !== pick)
      .sort((a, b) => b.sample - a.sample)
      .map((x) => x.provider);
    const coldPicks = withoutData.filter((p) => p !== pick);
    return [pick, ...exploitedPicks, ...shuffle(coldPicks)];
  }

  withData.sort((a, b) => b.sample - a.sample);

  // Tie-breaker: dua arm teratas terlalu dekat → pilih yang berpengalaman
  // (pulls lebih banyak) agar keputusan stabil antar request.
  if (withData.length >= 2) {
    const [top, second] = withData;
    if (top.sample - second.sample < TIE_BREAK_MARGIN) {
      const [byExp] = [...withData].sort((a, b) => b.pulls - a.pulls);
      const chosen = byExp.provider;
      const rest = withData.filter((x) => x.provider !== chosen).map((x) => x.provider);
      return [chosen, ...rest, ...shuffle(withoutData)];
    }
  }

  return [...withData.map((x) => x.provider), ...shuffle(withoutData)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Online update ─────────────────────────────────────────────────────────

/**
 * Catat hasil satu run LLM dan perbarui posterior bandit.
 * Aman dipanggil fire-and-forget — kegagalan log tidak menggagalkan chat.
 */
export async function recordBanditOutcome(input: {
  task: string;
  provider: string;
  success: boolean;
  status: 'success' | 'error' | 'fallback';
  latencyMs: number;
  latencyTargetMs?: number;
  candidateProviders: string[];
}): Promise<void> {
  try {
    if (BANDIT_EXCLUDED_PROVIDERS.has(input.provider)) return;
    const config = await getBanditConfig();
    if (!config.enabled) return;

    // Read-modify-write serialized via mutex supaya update bersamaan tidak
    // saling timpa. Aman fire-and-forget — kegagalan tidak menggagalkan chat.
    await enqueue(async () => {
      const state = await getBanditState();
      const arms = (state[input.task] ??= {});
      const stats = (arms[input.provider] ??= emptyArm());

      const reward = computeReward({
        success: input.success,
        status: input.status,
        latencyMs: input.latencyMs,
        latencyTargetMs: input.latencyTargetMs ?? inferLatencyTarget(input.task),
        provider: input.provider,
        candidateProviders: input.candidateProviders,
        config,
      });

      stats.alpha += reward;
      stats.beta += 1 - reward;
      stats.pulls += 1;
      stats.rewardSum += reward;
      stats.lastPullAt = Date.now();
      if (input.success) stats.successCount += 1;
      if (input.latencyMs > 0) {
        stats.latencyEmaMs = stats.latencyEmaMs === 0 ? input.latencyMs : stats.latencyEmaMs * 0.8 + input.latencyMs * 0.2;
      }

      await persistBanditState(state);
    });
  } catch {
    // bandit must never break chat
  }
}

export async function resetBanditState(): Promise<void> {
  // Lewat mutex supaya tidak bertabrakan dengan outcome in-flight yang
  // membaca state lama lalu menulis setelah reset (menimpa reset).
  await enqueue(async () => {
    await persistBanditState({});
  });
}

export function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}