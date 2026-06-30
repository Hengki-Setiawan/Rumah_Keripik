# MEMORY — Rumah Kripik Chatbot Commerce

> Baca file ini duluan tiap kali resume sesi untuk memahami konteks penuh.
> Update file ini setiap ada keputusan, perubahan arsitektur, atau progress signifikan.

---

## 1. IDENTITAS PROYEK

**Nama:** Rumah Kripik Chatbot Commerce  
**Deskripsi:** Dashboard manajemen + chatbot WhatsApp untuk UMKM keripik. Pelanggan WA bisa chat (otomatis via AI atau manual admin), lihat katalog, pesan, dan admin pantau lewat dashboard.  
**Tujuan Final:** Sistem commerce WhatsApp end-to-end: katalog → chat → pesan → transaksi → laporan,全部 serverless (biaya Rp 0/month).  
**User:** Pemilik UMKM Rumah Kripik (non-teknis). Admin operasional.  
**Bahasa:** Indonesia (UI + chatbot + kode).  

---

## 2. TECH STACK (PASTI, JANGAN UBAH)

| Layer | Teknologi | Versi | Catatan |
|-------|-----------|-------|---------|
| Framework | Next.js | 16.2.9 | Turbopack; middleware deprecated (ganti "proxy") |
| UI Library | React | 19.2.4 | Server Actions, 'use client' |
| CSS | Tailwind CSS | v4 | PostCSS, `@tailwindcss/postcss` v4 |
| Component | lucide-react | ^0.383 | Icons saja — **tidak pakai shadcn/ui** |
| Chart | recharts | ^2.12 | line, bar, pie chart |
| Database ORM | Drizzle ORM | ^0.31 | SQLite dialect via `drizzle-orm/sqlite-core` |
| Database | Turso (libSQL) | via `@libsql/client` ^0.6 | Serverless, free tier |
| Auth | NextAuth v5 | beta | Credentials provider, JWT strategy |
| WA Gateway | Evolution API | v2 | WhatsApp gateway langsung ke server Evolution |
| LLM Primary | Groq | llama-3.3-70b-versatile → llama-3.1-8b-instant | Chain fallback 70b→8b→Gemini |
| LLM Fallback | Gemini 2.0 Flash | via REST API | Juga untuk embedding: `gemini-embedding-001` (3072d) |
| WA Sender | Evolution API | via HTTP API | `evolution.ts` dipakai untuk kirim pesan |
| Date | **TIDAK pakai** date-fns | — | Format manual via `Intl` |
| Table | **TIDAK pakai** @tanstack/react-table | — | Manual table rendering |
| EVOLUTION API | **ACTIVE** | — | `evolution.ts` dipakai untuk Evolution webhook dan kirim pesan |

**PENTING — Next.js 16.2.9 BREAKING CHANGES:**
- `"middleware"` file convention deprecated, ganti dengan `"proxy"`
- Cek `node_modules/next/dist/docs/` sebelum tulis kode baru
- Jangan asumsi API behavior sama dengan Next.js 14/15

---

## 3. ARSITEKTUR (SERVERLESS, TANPA VPS)

```
User WA ──→ Evolution API ──→ /api/webhook/wa (Next.js)
                                        │
                                   chatbot-router.ts
                                  ┌───┴───┐
                                  │ Rule? │ → balas dari bot_auto_reply
                                  └───┬───┘
                                      │ (no match)
                                  ┌───┴───┐
                                  │  RAG  │ → cari di ai_knowledge_base
                                  └───┬───┘
                                      │ (dapat context)
                                  ┌───┴──────┐
                                  │ LLM Chain │ → Groq → Gemini fallback
                                  └───┬──────┘
                                      │
                                 evolution.ts ──→ sendTextMessage(number, text)
                                      │
                                 chat_log (log semua interaksi)
```

**Alur webhook:**
1. Meta → GET `/api/webhook/wa?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
2. Meta → POST `/api/webhook/wa` (tiap ada pesan baru)
3. `parseIncomingMessage()` → extract sender, text
4. `processIncomingMessage()` → router → response
5. `sendTextMessage()` → balas ke pelanggan
6. Log ke `chat_log` + update `pelanggan_chatbot.terakhir_aktif`

**Proxy:** proteksi semua route kecuali `/login`, `/api/auth`, `/api/webhook` (agar WA webhook bisa diakses publik).

---

## 4. DATABASE — 9 TABEL (Turso via Drizzle ORM)

### 4.1 pelanggan_chatbot
| Kolom | Tipe | Catatan |
|-------|------|---------|
| no_wa_pelanggan | text PK | 628xxx |
| nama_pelanggan | text | optional |
| alamat_pengiriman | text | optional |
| status_handle | enum: AI_Bot / Manual_Admin | default AI_Bot |
| context_sesi | text (JSON) | rolling window chat history |
| waktu_daftar | text (datetime) | auto UTC |
| terakhir_aktif | text (datetime) | auto UTC, diupdate tiap chat |

### 4.2 produk
- id_produk PK (KRP-001), nama_produk, deskripsi, harga_jual (integer Rupiah), stok_gudang_utama, is_active, updated_at

### 4.3 warung_retail
- id_warung PK (WRG-001), nama_warung, pemilik, no_wa_warung, alamat, tipe_kemitraan (Reseller/Agent/Dropshipper), min_order_grosir, is_active

### 4.4 transaksi
- id_transaksi PK (TX-YYYYMMDD-NNN), no_wa_pelanggan (FK nullable), id_warung (FK nullable), tipe_penjualan (Online_WA/Offline_Gudang), total_bayar, status_pembayaran (Lunas/Piutang/Tidak_Lunas), kode_pesanan (unique), catatan
- CHECK: minimal satu dari no_wa_pelanggan atau id_warung harus diisi

### 4.5 detail_transaksi
- id (auto increment PK), id_transaksi (FK cascade), id_produk (FK restrict), qty_terjual, harga_snapshot, subtotal

### 4.6 pesan_chat
- **HANYA pesan keluar** (direction='out'). Untuk live chat display.
- id (auto PK), no_wa_pelanggan (FK), sumber (bot/admin/sistem), teks, id_external, status_kirim (sent/failed)

### 4.7 ai_knowledge_base
- id (auto PK), judul, potongan_teks, kategori (FAQ/Produk/Pengiriman/Kebijakan), vector_embedding (blob F32 3072d), is_active

### 4.8 bot_auto_reply
- id (auto PK), keyword, response, is_active (default 1)
- Keyword match → langsung balas tanpa AI. Hemat token ~70%.

### 4.9 chat_log
- id (auto PK), no_wa_pelanggan, user_message, bot_response, sumber (rule/groq/gemini/not_found), model_used, tokens_used

**Patched `@libsql/client`:** `patch-package` mem-patch `lib-cjs/migrations.js` dan `lib-esm/migrations.js` agar treat Turso sebagai non-schema DB (hindari error 400). Berlaku permanent via `postinstall` script.

---

## 5. FILE MAP & FUNGSI

### Root
| File | Fungsi |
|------|--------|
| `package.json` | Next 16.2.9, React 19.2.4, Drizzle 0.31, patch-package, tsx |
| `next.config.ts` | default (kosong) |
| `drizzle.config.ts` | Turso driver, schema di `src/lib/schema.ts` |
| `tsconfig.json` | default Next.js |
| `AGENTS.md` | Warning Next.js 16 breaking changes |
| `CLAUDE.md` | Reference ke AGENTS.md |
| `FASE1_DATABASE.md` | Dokumentasi Fase 1 (outdated, untuk referensi) |
| `FASE2_DASHBOARD.md` | Dokumentasi Fase 2 (outdated, untuk referensi) |
| `_ctx/SUMMARY.md` | **INI FILE — memory agent** |

### `src/lib/` — Library & Helpers
| File | Fungsi |
|------|--------|
| `schema.ts` | 9 tabel Drizzle ORM + type exports |
| `db.ts` | Singleton Drizzle client (Turso) |
| `auth.ts` | NextAuth v5, Credentials, JWT |
| `groq.ts` | LLM chain: 70b→8b→Gemini, 12s timeout, 429 delay |
| `gemini.ts` | Embedding + query embedding (Gemini) |
| `evolution.ts` | Evolution API helper: sendText, sendButton, sendList, status, QR, parse |
| `chatbot-router.ts` | **NEW** Router: rule check → RAG → LLM → log |
| `chatbot-prompts.ts` | **NEW** System prompts (Indonesian) |
| `evolution.ts` | **DEPRECATED** — masih dipakai `chat.ts:kirimPesanManual` |
| `utils.ts` | formatRupiah, normalizePhoneNumber |
| `id-generator.ts` | generateIdProduk, IdWarung, IdTransaksi, KodePesanan |

### `src/actions/` — Server Actions
| File | Fungsi |
|------|--------|
| `produk.ts` | CRUD produk, stok, harga, toggle aktif |
| `warung.ts` | CRUD warung retail |
| `pelanggan.ts` | CRUD pelanggan, search, hapus (cek transaksi) |
| `transaksi.ts` | Catat transaksi offline, KPI, ranking produk, piutang |
| `chat.ts` | Daftar chat, ambil alih/lepas ke bot, kirim manual, riwayat |
| `knowledge-base.ts` | Upload + chunk + embed + toggle KB |
| `bot-config.ts` | CRUD auto reply rules, chat log, stats |

### `src/app/` — Pages & API Routes
| Path | Fungsi |
|------|--------|
| `(dashboard)/page.tsx` | Beranda: 7 module cards |
| `(dashboard)/layout.tsx` | Sidebar 9 menu, collapsible, responsive |
| `(dashboard)/analitik/page.tsx` | KPI cards + Realtime chart + ranking + transaksi + piutang |
| `(dashboard)/bot-config/page.tsx` | Auto Reply Rules + Log + Stats |
| `(dashboard)/knowledge-base/page.tsx` | Upload + list KB |
| `(dashboard)/livechat/page.tsx` | Daftar chat + ambil alih |
| `(dashboard)/master-data/produk/page.tsx` | CRUD produk |
| `(dashboard)/master-data/pelanggan/page.tsx` | List + cari pelanggan |
| `(dashboard)/master-data/warung/page.tsx` | CRUD warung |
| `(dashboard)/master-data/transaksi-offline/page.tsx` | Catat transaksi |
| `(auth)/login/page.tsx` | Login form |
| `api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `api/webhook/wa/route.ts` | **NEW** — Evolution webhook GET+POST |
| `proxy.ts` | Auth guard (public: /login, /api/auth, /api/webhook) |

### `src/scripts/`
| File | Fungsi |
|------|--------|
| `seed.ts` | Seed data awal: 4 produk, 2 warung, 2 pelanggan, 5 KB |
| `reembed-kb.ts` | Re-embed semua KB entry via Gemini |

### `patches/`
| File | Fungsi |
|------|--------|
| `@libsql+client+0.6.2.patch` | Patch migration check untuk Turso (CJS + ESM) |

### `src/drizzle/`
| File | Fungsi |
|------|--------|
| `migrations/0000_*.sql` | Migration awal (7 tabel) |
| `migrations/0001_*.sql` | Migration add bot_auto_reply + chat_log |
| `migrations-manual/0001_vector_setup.sql` | Vector index SQL (manual execute via Turso CLI) |

---

## 6. DECISIONS LOG

| # | Keputusan | Alasan | Tanggal |
|---|-----------|--------|---------|
| 1 | **Tidak pakai VPS/Docker** | Biaya Rp 0, serverless all-in | Sesi awal |
| 2 | **Evolution API > WhatsApp Cloud API** | Lebih cepat setup, langsung ke server Evolution | Sesi 2 |
| 3 | **Tidak pakai n8n** | Semua logic di TypeScript | Sesi 2 |
| 4 | **Groq > Gemini untuk main LLM** | Gratis unlimited, lebih cepat, 70b > 2.0 Flash | Sesi awal |
| 5 | **Gemini untuk embedding** | Gratis, 3072d, akurat | Sesi awal |
| 6 | **Auto Reply Rules** | Hemat ~70% token, instant response | Sesi 2 |
| 7 | **chat_log terpisah dari pesan_chat** | Monitoring bot vs live chat beda concern | Sesi 2 |
| 8 | **Tidak pakai shadcn/ui** | Overhead, Tailwind 4 cukup | Sesi awal |
| 9 | **patch-package @libsql/client** | Turso ga support migration check di API | Sesi 3 |
| 10 | **Google Stitch untuk UI design** | User desain dulu baru implement | Sesi 2 |
| 11 | **Context sesi via JSON di pelanggan_chatbot** | Simple, ga perlu tabel chat terpisah | Sesi ini |
| 12 | **RAG via LIKE search (bukan vector search)** | Vector search belum terverifikasi kerja di Turso | Sesi ini |

---

## 7. CURRENT STATE (25 Juni 2026)

### ✅ SELESAI
- Build 0 error (TypeScript + kompilasi + static generation)
- 9 tabel di Turso (termasuk bot_auto_reply, chat_log)
- `@libsql/client` patch (CJS + ESM) via patch-package
- Auth (NextAuth v5, proxy)
- Dashboard: sidebar, beranda, analitik, produk, pelanggan, warung, transaksi-offline, livechat, knowledge-base, bot-config
- CRUD server actions: produk, warung, pelanggan, transaksi, chat, knowledge-base, bot-config
- LLM chain: Groq (70b→8b→Gemini) dengan 12s timeout + 429 fallback
- Gemini embedding (3072d) untuk RAG
- `evolution.ts` — Evolution API helper (send, parse, status, QR)
- `chatbot-router.ts` — Intent router (rule → RAG → LLM → log)
- `chatbot-prompts.ts` — System prompts (Indonesian)
- `/api/webhook/wa` — WA webhook endpoint
- Evolution API aktif sebagai jalur utama WA
- `.env.local` updated with Evolution env vars
- Seed data + migration applied

### 🔄 IN PROGRESS
- (none)

### ⏳ BLOCKED (butuh user action)
- **Evolution API**: server Evolution aktif + `EVOLUTION_API_KEY`
- **Webhook URL setup**: set webhook Evolution ke `https://.../api/webhook/wa`
- **Vercel deploy**: Belum deploy
- **API key rotation**: Live keys masih di `.env.local`
- **Desain UI**: User akan desain di Google Stitch dulu

### 📋 NEXT STEPS (prioritas)
1. **[USER] Isi .env.local / Vercel**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
2. **[USER] Set webhook Evolution** ke `/api/webhook/wa`
3. **[CODE] Implement context_sesi** — rolling window 5 chat di pelanggan_chatbot.context_sesi
4. **[USER] Desain UI di Google Stitch**
5. **[CODE] Implement UI redesign sesuai desain**
6. **[CODE] Deploy ke Vercel**
7. **[CODE] Rotasi API keys + strong passwords + `.gitignore` validasi**

---

## 8. ENV VARS (.env.local)

```env
TURSO_DATABASE_URL=libsql://rumah-keripik-rumahkeripik.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=eyJ...          # Turso token (LIVE — rotate before deploy)

GROQ_API_KEY=gsk_...              # GROQ (LIVE — rotate before deploy)
GEMINI_API_KEY=AQ...              # Gemini (LIVE — rotate before deploy)

NEXTAUTH_SECRET=dev-secret-key-not-for-production
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123           # GANTI sebelum deploy!

EVOLUTION_API_URL=https://wa.rumahkripik.com
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=rumah-kripik-bot
```

---

## 9. GOTCHAS & CRITICAL NOTES

- **Dev server:** run via `npm run dev` dari root project. Butuh folder `D:\Vibe coding (Semester 7)\Rumah Keripik\rumah-kripik-app`. Long timeout di terminal.
- **Turbopack:** build pake Turbopack (default Next 16). Jika error aneh, coba `NO_TURBOPACK=1 npm run build`.
- **Middleware → Proxy:** sudah dimigrasikan ke `src/proxy.ts`.
- **@libsql/client patch:** Jangan lupa `npm run postinstall` atau `npx patch-package` jika node_modules dihapus.
- **Vector search di Turso:** Belum terverifikasi. Untuk sekarang RAG pake LIKE search aja. Vector search bisa diaktifkan nanti via `vector_distance_cos` jika extension libsql_vector tersedia.
- **Evolution API:** jalur utama WhatsApp sekarang lewat Evolution API, jadi tidak wajib Meta Cloud API.
- **Webhook Evolution:** set webhook ke `/api/webhook/wa` di server Evolution.
- **Chat history context:** `pelanggan_chatbot.context_sesi` belum diimplement — masih null/empty. Rencana: rolling window 5 chat (user + bot) sebagai JSON array, dikirim ke LLM sebagai history messages.
- **`kirimPesanManual` di `chat.ts`**: sudah memakai Evolution API.

---

## 10. BUILD HISTORY

| # | Tanggal | Status | Catatan |
|---|---------|--------|---------|
| 1 | Sesi 1 | ✅ 0 error | Setup awal, schema, actions, auth, dashboard |
| 2 | Sesi 2 | ✅ 0 error | + bot-config, chat_log, bot_auto_reply, LLM chain |
| 3 | Sesi 3 | ❌ Gagal | `@libsql/client` error 400 — migration check gagal di ESM |
| 4 | Sesi 3 | ✅ 0 error | Patch `@libsql/client` — CJS dulu |
| 5 | Sesi 4 | ❌ Gagal | ESM `migrations.js` masih error 400 |
| 6 | Sesi 4 | ✅ 0 error | Patch ESM `migrations.js` juga, `patch-package` persist via `postinstall` |
| 7 | Sesi 5 | ✅ 0 error | + evolution.ts, chatbot-router.ts, chatbot-prompts.ts, /api/webhook/wa |

**Command:** `npm run build` — Next.js 16.2.9 Turbopack, TypeScript strict.

---

## 11. GIT STATUS

Bukan git repo. Semua file lokal di `D:\Vibe coding (Semester 7)\Rumah Keripik\`. Belum ada version control. Disarankan inisialisasi git sebelum deploy ke Vercel.

