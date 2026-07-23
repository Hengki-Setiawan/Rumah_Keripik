# MEMORY — Rumah Keripik

> **Dokumen ini bukan lagi sumber kebenaran arsitektur.**
> Lihat file berikut untuk informasi akurat dan terkini:

| Topik | File |
|-------|------|
| Arsitektur & Roadmap | `Blueprint/00_MASTER_INTEGRATION_BLUEPRINT.md` |
| Detail Web | `Blueprint/01_BLUEPRINT_WEB_PUSAT.md` |
| Detail Mobile | `Blueprint/02_BLUEPRINT_MOBILE_PELANGGAN.md` |
| Detail Courier | `Blueprint/03_BLUEPRINT_COURIER_KURIR.md` |
| Schema Database | `_ctx/SCHEMA_SNAPSHOT.md` (auto-generated) |
| Design Tokens | `design-tokens.json` |
| Disaster Recovery | `DISASTER_RECOVERY.md` |
| Panduan Agent | `AGENTS.md` |

## Quick Facts (verifikasi dari file di atas)

- **Stack:** Next.js 16 + React 19 + Drizzle/Turso + NextAuth v5
- **Database:** Turso (libSQL), 68 tables
- **AI Router:** Groq → Gemini 2.5 Flash → Cerebras → Deterministic fallback
- **Hosting:** Vercel (web), Expo EAS (mobile/courier APK)
- **Repos:** `Hengki-Setiawan/Rumah_Keripik` (web), `Rumah_Keripik_Mobile`, `Rumah_Keripik_Courier`

> **Peringatan:** Jangan edit file ini untuk detail arsitektur — update file Blueprint sebagai gantinya.
> File ini hanya ringkasan pointer ke sumber kebenaran yang sebenarnya.
