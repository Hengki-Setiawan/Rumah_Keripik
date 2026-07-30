# Monitoring Setup

## 1. Sentry (Error Tracking)
Sudah terintegrasi di `_layout.tsx` (courier app) dan project web.
- Set `SENTRY_DSN` di Vercel Production env
- Set `SENTRY_AUTH_TOKEN` untuk source map upload
- Courier app: init dipanggil di `app/_layout.tsx`

## 2. Health Check Endpoint
Production endpoint: `GET /api/health`
Returns `200 OK` jika database terkoneksi, `503` jika tidak.
Gunakan untuk uptime monitoring (Better Uptime / UptimeRobot / Pingdom).

## 3. Uptime Monitoring (Free)
Recommended: [Better Uptime](https://betteruptime.com) — free tier monitors 1 endpoint every 1 minute.

### Setup:
1. Create account at Better Uptime
2. Add monitor:
   - URL: `https://rumah-keripik.vercel.app/api/health`
   - Expected status: 200
   - Check interval: 1 minute
3. Add alert contacts: email + Telegram (via Better Uptime Telegram integration)
4. Enable status page (free): `https://rumah-keripik.betteruptime.com`

Alternative: [UptimeRobot](https://uptimerobot.com) — free 50 monitors, 5-min interval.

## 4. Cron Job Monitoring
Vercel Cron di `vercel.json` menjalankan:
- `/api/cron/payment-ops` — 01:00 UTC daily
- `/api/cron/worker` — 02:00 UTC daily

Monitor via Vercel Dashboard > Cron Jobs tab.
Create Better Uptime monitor for each cron job to detect failures.

## 5. Logging
- Vercel logs via dashboard: https://vercel.com/.../logs
- Courier app: Sentry captures unhandled errors + manual captures
- Rate limit violations logged to console.error

## 6. Performance Monitoring
- Web Vitals: Sentry Performance (enable in config)
- API response times: Sentry transactions (auto-instrumented)
- Database query times: Sentry (optional, via drizzle hook)

## 7. Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Uptime | <99.5% (24h) | <99% (24h) |
| API 5xx rate | >1% (5min) | >5% (5min) |
| Sentry error count | >10/day | >50/day |
| Auth failures | >20/15min | >50/15min |
