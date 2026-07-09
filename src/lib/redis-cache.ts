const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function getCachedData<T>(key: string): Promise<T | null> {
  if (!redisUrl || !redisToken) return null;
  try {
    const cleanUrl = redisUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', key]),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        return JSON.parse(data.result) as T;
      }
    }
  } catch (error) {
    console.error(`Redis cache GET failed for key: ${key}`, error);
  }
  return null;
}

export async function setCachedData(key: string, data: any, ttlSeconds: number): Promise<void> {
  if (!redisUrl || !redisToken) return;
  try {
    const cleanUrl = redisUrl.replace(/\/$/, "");
    await fetch(`${cleanUrl}/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(data), 'EX', ttlSeconds]),
      cache: 'no-store',
    });
  } catch (error) {
    console.error(`Redis cache SET failed for key: ${key}`, error);
  }
}
