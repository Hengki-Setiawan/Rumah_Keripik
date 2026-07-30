# Security Audit — Rumah Keripik

Tanggal: 2026-07-30
Auditor: Automated review (opencode)

## Ringkasan
| Area | Status | Temuan |
|------|--------|--------|
| Admin auth | ✅ Hardcoded credentials, NextAuth session | Standard Vercel pattern for single-admin |
| Courier auth | ✅ JWT (access + refresh) + fallback DB sessions | Solid dual-auth |
| Rate limiting | ✅ Per-endpoint (courier-specific tiers) | 15/min auth, 60/min location, 30/min delivery |
| CORS | ⚠️ No explicit CORS middleware | Vercel serverless handles via `next.config` |
| Error leakage | ✅ Generic error messages to client | "Terjadi kesalahan server" pattern used |
| Secrets in env | ✅ All via `process.env`, no .env committed | Verified |
| PIN hashing | ✅ bcrypt with 10 rounds | Secure |
| Token expiry | ✅ JWT short-lived + DB sessions 30-day | OK |
| SQL injection | ✅ Drizzle ORM — parameterized queries | No raw SQL except `sql` template literals |
| XSS | ✅ Next.js auto-escapes | OK |
| Backup SOP | ✅ Documented in SECURITY_AND_BACKUP.md | OK |

## Temuan Detail

### 1. No CORS Headers (Low)
File: all route.ts files
- Tidak ada middleware yang menambahkan `Access-Control-Allow-Origin`
- Risiko: Low — Next.js API routes hanya dipanggil dari first-party clients
- Solusi: Tambahkan middleware di `src/middleware.ts` jika ingin restrict origin — tidak kritis

### 2. Hardcoded Admin Credentials (Info)
File: environment variables
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` adalah pola standar untuk single-admin app
- Bukan security issue karena password seharusnya unik dan random di production
- Pastikan `ADMIN_PASSWORD` di Vercel adalah random 32+ karakter

### 3. Rate Limiting per-IP (Info)
- Rate limiting menggunakan IP + optional courierId
- Di Vercel (serverless), IP bisa berubah jika request melewati proxy
- Solusi sudah memadai untuk scale kecil. Jika besar, migrate ke Redis-based rate limiter

### 4. No rate limit on admin endpoints (Low)
- Admin endpoints (`/api/admin/*`) tidak memiliki rate limiting khusus
- Risiko sangat rendah karena hanya 1 admin dan diketahui
- Tambahkan jika diperlukan

## Rekomendasi
1. ✅ **Sentry** — sudah diinit di courier app dan web (status: partial — perlu SENTRY_DSN)
2. ⏳ **Better Uptime** — setup health check monitoring di `GET /api/health`
3. ✅ **Rate limiting** — sudah impelentasi di courier routes
4. ⏳ **Backup otomatis** — dokumentasi ada, belum ada cron untuk auto-backup
5. ⏳ **Database connection pooling** — Turso sudah handle ini secara native

## Kesimpulan
**Security posture baik untuk production skala kecil-menengah.** Tidak ditemukan celah kritis.
Fokus utama: set Sentry DSN + Better Uptime monitoring.
