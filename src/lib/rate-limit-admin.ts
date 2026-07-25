import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const ROLE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  owner: { limit: 300, windowMs: 60_000 },
  operator: { limit: 120, windowMs: 60_000 },
  finance: { limit: 120, windowMs: 60_000 },
  courier_admin: { limit: 200, windowMs: 60_000 },
  product_admin: { limit: 150, windowMs: 60_000 },
  customer_support: { limit: 100, windowMs: 60_000 },
  viewer: { limit: 60, windowMs: 60_000 },
}

const DEFAULT_LIMIT = { limit: 60, windowMs: 60_000 }

export async function checkAdminRateLimit(role: string, req: Request) {
  const config = ROLE_LIMITS[role] || DEFAULT_LIMIT
  const ip = getClientIp(req)
  const key = `admin:${role}:${ip}`
  return checkRateLimit(key, config.limit, config.windowMs)
}