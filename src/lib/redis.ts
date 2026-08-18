import { Redis } from '@upstash/redis';

export interface CachedCourierLocation {
  courierId: number;
  lat: string;
  lng: string;
  recordedAt: string;
  speed?: number | null;
  accuracy?: number | null;
  orderId?: string | null;
}

// In-memory fallback if Upstash credentials are not yet configured in local environment
const inMemoryLocationCache = new Map<number, CachedCourierLocation>();

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    try {
      redisClient = new Redis({ url, token });
      return redisClient;
    } catch (err) {
      console.warn('[REDIS] Failed to initialize Upstash Redis client, using fallback:', err);
      return null;
    }
  }

  return null;
}

const COURIER_LOCATIONS_KEY = 'courier:locations:hash';
const LOCATION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Cache high-frequency courier GPS coordinates to Upstash Redis (or in-memory fallback)
 */
export async function cacheCourierLocation(data: CachedCourierLocation): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      // 1. Store in Hash for fast lookup by courier ID
      await redis.hset(COURIER_LOCATIONS_KEY, {
        [data.courierId.toString()]: JSON.stringify(data),
      });

      // 2. Also store in Redis GEO index for geospatial queries if lat/lng are valid numbers
      const latNum = parseFloat(data.lat);
      const lngNum = parseFloat(data.lng);
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        await redis.geoadd('courier:geo', {
          longitude: lngNum,
          latitude: latNum,
          member: data.courierId.toString(),
        }).catch(() => undefined);
      }
      return;
    } catch (err) {
      console.warn('[REDIS] Error writing courier location to Redis, updating fallback:', err);
    }
  }

  // Fallback in-memory
  inMemoryLocationCache.set(data.courierId, data);
}

/**
 * Get all cached courier locations from Upstash Redis (or in-memory fallback)
 */
export async function getAllCachedCourierLocations(): Promise<Map<number, CachedCourierLocation>> {
  const resultMap = new Map<number, CachedCourierLocation>();
  const redis = getRedisClient();

  if (redis) {
    try {
      const allEntries = await redis.hgetall<Record<string, string | CachedCourierLocation>>(COURIER_LOCATIONS_KEY);
      if (allEntries && typeof allEntries === 'object') {
        for (const [idStr, raw] of Object.entries(allEntries)) {
          const courierId = parseInt(idStr, 10);
          if (!isNaN(courierId)) {
            const locData: CachedCourierLocation = typeof raw === 'string' ? JSON.parse(raw) : raw;
            resultMap.set(courierId, locData);
          }
        }
        return resultMap;
      }
    } catch (err) {
      console.warn('[REDIS] Error reading courier locations from Redis, using fallback:', err);
    }
  }

  // Fallback in-memory
  for (const [id, data] of inMemoryLocationCache.entries()) {
    resultMap.set(id, data);
  }

  return resultMap;
}
