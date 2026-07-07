'use server';

import { desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { adminAuditLog, aiLearningEvents, aiRuns, aiToolCalls, botSetting, chatSessions, failedConversation, recommendationEvents, transaksi } from '@/lib/schema';
import { defaultProviderConfigs, defaultTaskConfigs } from '@/lib/ai/model-router';
import { tambahKnowledgeBase } from '@/actions/knowledge-base';

export async function getAiMonitorData() {
  const [runs, toolCalls, failed, stats, providerBreakdown, taskBreakdown, recommendationStats, learningEvents, chatOrderStats] = await Promise.all([
    db.select().from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(80),
    db.select().from(aiToolCalls).orderBy(desc(aiToolCalls.createdAt)).limit(80),
    db.select().from(failedConversation).orderBy(desc(failedConversation.created_at)).limit(40),
    db.select({
      totalRuns: sql<number>`COUNT(*)`,
      fallbackRuns: sql<number>`SUM(CASE WHEN status = 'fallback' THEN 1 ELSE 0 END)`,
      errorRuns: sql<number>`SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)`,
      totalOutputTokens: sql<number>`SUM(output_tokens)`,
      avgLatencyMs: sql<number>`AVG(latency_ms)`,
    }).from(aiRuns).then((rows) => rows[0]),
    db.select({ provider: aiRuns.provider, total: sql<number>`COUNT(*)`, errors: sql<number>`SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)`, avgLatencyMs: sql<number>`AVG(latency_ms)` }).from(aiRuns).groupBy(aiRuns.provider).limit(20),
    db.select({ task: aiRuns.task, total: sql<number>`COUNT(*)`, fallback: sql<number>`SUM(CASE WHEN status = 'fallback' THEN 1 ELSE 0 END)` }).from(aiRuns).groupBy(aiRuns.task).limit(20),
    db.select({ eventType: recommendationEvents.eventType, total: sql<number>`COUNT(*)` }).from(recommendationEvents).groupBy(recommendationEvents.eventType).catch(() => []),
    db.select().from(aiLearningEvents).orderBy(desc(aiLearningEvents.createdAt)).limit(60).catch(() => []),
    db.select({ total: sql<number>`COUNT(*)` }).from(transaksi).leftJoin(chatSessions, eq(transaksi.id_transaksi, chatSessions.activeOrderId)).where(sql`${chatSessions.id} IS NOT NULL`).then((rows) => rows[0]).catch(() => ({ total: 0 })),
  ]);
  return { runs, toolCalls, failed, stats, providerBreakdown, taskBreakdown, recommendationStats, learningEvents, chatOrderStats };
}

export async function getAiAuditEvents() {
  const [adminEvents, learningEvents] = await Promise.all([
    db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(200).catch(() => []),
    db.select().from(aiLearningEvents).orderBy(desc(aiLearningEvents.createdAt)).limit(200),
  ]);
  return { adminEvents, learningEvents };
}

export async function getModelRouterSettings() {
  const keys = ['ai.provider.configs', 'ai.task.configs'];
  const rows = await Promise.all(keys.map((key) => db.select().from(botSetting).where(eq(botSetting.key, key)).limit(1).then((items) => items[0])));
  const providerConfigs = rows[0]?.value_json ? safeJson(rows[0].value_json, defaultProviderConfigs) : defaultProviderConfigs;
  const taskConfigs = rows[1]?.value_json ? safeJson(rows[1].value_json, defaultTaskConfigs) : defaultTaskConfigs;
  return { providerConfigs, taskConfigs };
}

export async function saveModelRouterSettings(input: { providerConfigsJson: string; taskConfigsJson: string }) {
  const providerConfigs = safeJson(input.providerConfigsJson, null);
  const taskConfigs = safeJson(input.taskConfigsJson, null);
  if (!providerConfigs || !taskConfigs) return { ok: false, error: 'JSON config tidak valid' };

  await Promise.all([
    upsertSetting('ai.provider.configs', JSON.stringify(providerConfigs, null, 2)),
    upsertSetting('ai.task.configs', JSON.stringify(taskConfigs, null, 2)),
  ]);
  revalidatePath('/model-router');
  return { ok: true };
}

export async function resolveFailedConversation(id: number, note: string) {
  await db.update(failedConversation).set({ resolved: 1, admin_note: note || 'Diselesaikan dari Feedback Learning', reviewed_at: sql`(datetime('now', 'utc'))` }).where(eq(failedConversation.id, id));
  revalidatePath('/feedback-learning');
  return { ok: true };
}

export async function createKnowledgeFromFailedConversation(id: number, input?: { title?: string; answer?: string; category?: string }) {
  const [item] = await db.select().from(failedConversation).where(eq(failedConversation.id, id)).limit(1);
  if (!item) return { ok: false, error: 'Feedback tidak ditemukan' };

  const title = input?.title?.trim() || `Feedback ${item.reason}: ${item.user_message.slice(0, 60)}`;
  const answer = input?.answer?.trim() || 'Admin perlu melengkapi jawaban resmi untuk pertanyaan ini.';
  const content = [
    `Pertanyaan customer: ${item.user_message}`,
    `Jawaban resmi: ${answer}`,
    item.raw_ai_output ? `Output AI sebelumnya untuk review: ${item.raw_ai_output.slice(0, 500)}` : null,
  ].filter(Boolean).join('\n\n');

  const result = await tambahKnowledgeBase(title, content, input?.category || 'Fallback');
  if (!result.success) return { ok: false, error: result.message };

  await db.update(failedConversation).set({ resolved: 1, admin_note: `Dibuat menjadi KB: ${title}`, reviewed_at: sql`(datetime('now', 'utc'))` }).where(eq(failedConversation.id, id));
  revalidatePath('/feedback-learning');
  revalidatePath('/knowledge-base');
  return { ok: true };
}

async function upsertSetting(key: string, valueJson: string) {
  const [existing] = await db.select().from(botSetting).where(eq(botSetting.key, key)).limit(1);
  if (existing) {
    await db.update(botSetting).set({ value_json: valueJson, updated_at: sql`(datetime('now', 'utc'))`, updated_by: 'admin' }).where(eq(botSetting.key, key));
  } else {
    await db.insert(botSetting).values({ key, value_json: valueJson, updated_by: 'admin' });
  }
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
