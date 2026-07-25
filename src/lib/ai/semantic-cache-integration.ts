import { isCacheable } from '@/lib/ai/semantic-cache';
import { generateTextWithRouter } from '@/lib/ai/model-router';

let vectorCache: Map<string, { response: string; category: string; createdAt: number }> | null = null;

function getCache(): Map<string, { response: string; category: string; createdAt: number }> {
  if (!vectorCache) vectorCache = new Map();
  return vectorCache;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function semanticCacheLookup(
  query: string,
  task?: string,
): Promise<{ hit: boolean; response?: string }> {
  if (!isCacheable({ query, task })) return { hit: false };

  try {
    const embedding = await generateTextWithRouter({
      task: 'faq_answer' as any,
      messages: [{ role: 'user', content: `Embed: ${query}` }],
      maxTokens: 10,
      temperature: 0,
    }).catch(() => null);

    if (!embedding) {
      const cache = getCache();
      const now = Date.now();
      for (const [key, entry] of cache.entries()) {
        if (now - entry.createdAt > CACHE_TTL_MS) {
          cache.delete(key);
          continue;
        }
        if (simpleSimilarity(query, key) > 0.85 && entry.category === task) {
          return { hit: true, response: entry.response };
        }
      }
      return { hit: false };
    }

    return { hit: false };
  } catch {
    return { hit: false };
  }
}

export async function semanticCacheStore(
  query: string,
  response: string,
  task: string,
): Promise<void> {
  if (!isCacheable({ query, task })) return;

  try {
    const cache = getCache();
    cache.set(query, { response, category: task, createdAt: Date.now() });
    if (cache.size > 200) {
      const oldest = cache.entries().next().value;
      if (oldest) cache.delete(oldest[0]);
    }
  } catch {}
}

function simpleSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const bTokens = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }
  return intersection / Math.max(aTokens.size, bTokens.size);
}