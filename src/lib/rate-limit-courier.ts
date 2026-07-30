import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const COURIER_LIMITS = {
  auth: { limit: 15, windowMs: 60_000 },          // login attempts
  location: { limit: 60, windowMs: 60_000 },       // location updates per min
  locationBatch: { limit: 120, windowMs: 60_000 }, // batch location
  delivery: { limit: 30, windowMs: 60_000 },       // delivery mutations
  general: { limit: 60, windowMs: 60_000 },        // default
}

export async function checkCourierRateLimit(
  kind: keyof typeof COURIER_LIMITS,
  req: Request,
  courierId?: number,
) {
  const config = COURIER_LIMITS[kind] || COURIER_LIMITS.general
  const ip = getClientIp(req)
  const key = `courier:${kind}:${courierId ?? ip}:${ip}`
  return checkRateLimit(key, config.limit, config.windowMs)
}

export { COURIER_LIMITS }
