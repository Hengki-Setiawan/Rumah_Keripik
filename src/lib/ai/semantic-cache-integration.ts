import { CACHEABLE_CATEGORIES, isCacheable } from '@/lib/ai/semantic-cache';
import { getCachedData, setCachedData } from '@/lib/redis-cache';

const CACHE_TTL_SEC = 12 * 60 * 60;
const CACHE_TTL_MS = CACHE_TTL_SEC * 1000;

const localFallbackCache = new Map<string, { response: string; category: string; createdAt: number }>();

function getLocalCache(): Map<string, { response: string; category: string; createdAt: number }> {
  return localFallbackCache;
}

export async function semanticCacheLookup(
  query: string,
  task?: string,
): Promise<{ hit: boolean; response?: string }> {
  if (query.trim().length < 4) return { hit: false };
  const tasks = task ? [task] : Array.from(CACHEABLE_CATEGORIES);

  for (const candidate of tasks) {
    if (!isCacheable({ query, task: candidate })) continue;
    try {
      const redisKey = `semantic:${candidate}:${query.slice(0, 100)}`;
      const redisHit = await getCachedData<{ response: string; category: string }>(redisKey);
      if (redisHit) {
        return { hit: true, response: redisHit.response };
      }

      const local = getLocalCache();
      const now = Date.now();
      for (const [key, entry] of local.entries()) {
        if (now - entry.createdAt > CACHE_TTL_MS) {
          local.delete(key);
          continue;
        }
        if (simpleSimilarity(query, key) > 0.85 && entry.category === candidate) {
          return { hit: true, response: entry.response };
        }
      }
    } catch {
      continue;
    }
  }

  return { hit: false };
}

export async function semanticCacheStore(
  query: string,
  response: string,
  task: string,
): Promise<void> {
  if (query.trim().length < 4 || response.trim().length < 10) return;

  try {
    const redisKey = `semantic:${task}:${query.slice(0, 100)}`;
    setCachedData(redisKey, { response, category: task }, CACHE_TTL_SEC).catch(() => {});

    const local = getLocalCache();
    local.set(query, { response, category: task, createdAt: Date.now() });
    if (local.size > 200) {
      const oldest = local.entries().next().value;
      if (oldest) local.delete(oldest[0]);
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