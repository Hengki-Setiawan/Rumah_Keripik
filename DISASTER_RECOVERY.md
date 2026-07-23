# Disaster Recovery Plan — Rumah Keripik

> Dokumen ini mendefinisikan prosedur pemulihan bencana untuk sistem Rumah Keripik.
> Update dokumen ini setiap kali ada perubahan arsitektur signifikan.

## RTO / RPO Target

| Metrik | Target | Metode |
|---|---|---|
| RTO (Recovery Time Objective) | < 4 jam | Restore dari backup Turso + redeploy Vercel |
| RPO (Recovery Point Objective) | < 24 jam | Backup harian otomatis via `npm run db:backup` |

## Skenario Bencana

### 1. Korupsi Data / Human Error (mis. admin hapus tabel)

**Deteksi:**
- Admin melaporkan data hilang/tidak konsisten
- Monitoring anomaly detection di dashboard

**Prosedur:**
1. Hentikan write operations: set maintenance mode di Vercel env `MAINTENANCE_MODE=true`
2. Identifikasi scope kerusakan: tabel mana, baris mana, sejak kapan
3. Pilih snapshot backup terdekat SEBELUM insiden
4. Restore ke database branch baru:
   ```bash
   turso db branch create rumah-keripik restore-<YYYYMMDD>
   ```
5. Verifikasi integritas data di branch restore
6. Export data yang rusak dari branch restore, import ke produksi
7. Nonaktifkan maintenance mode
8. Catat insiden di `backup_restore_drills`

### 2. Turso Outage / Database Unreachable

**Deteksi:**
- Monitoring melaporkan error koneksi database
- Order tidak bisa diproses

**Prosedur:**
1. Turso adalah edge-replicated — biasanya tidak semua region down
2. Biarkan sistem cache layer (Vercel Edge) melayani read request
3. Write request ditolak dengan 503 Service Unavailable
4. Pantau status.turso.tech
5. Setelah Turso pulih, verifikasi data consistency
6. Proses antrian write yang tertunda

### 3. Vercel Platform Outage

**Deteksi:**
- Vercel status page (https://www.vercel-status.com) mengonfirmasi
- Dashboard tidak bisa diakses

**Prosedur:**
1. Vercel biasanya punya redundancy otomatis — tunggu 15 menit
2. Jika > 30 menit: deploy ulang dari lokal:
   ```bash
   npm run build && npx vercel --prod
   ```
3. Jika Vercel benar-benar down: deploy ke alternatif (Railway / Render) menggunakan Dockerfile
4. Update DNS CNAME ke hosting alternatif

### 4. Data Breach / Keamanan

**Deteksi:**
- Aktivitas mencurigakan di log audit
- Laporan dari pengguna
- Monitoring security

**Prosedur:**
1. Isolasi: revoke semua token API dan sesi aktif
2. Rotasi semua secret (env vars, API keys, Turso tokens)
3. Identifikasi scope kebocoran
4. Backup data untuk investigasi forensik
5. Informasikan pihak terkait
6. Patch celah keamanan
7. Dokumentasikan insiden

### 5. AI Provider Outage (Groq/Gemini)

**Deteksi:**
- AI router failover ke fallback
- Monitoring `aiRuns` menunjukkan error rate tinggi

**Prosedur:**
1. Sistem sudah punya fallback chain: Groq → Gemini → deterministic
2. Jika semua provider down: order tetap bisa lewat form manual
3. Pantau provider status page
4. Jika outage berkepanjangan (> 1 jam): update konfigurasi di tabel `botSetting`

## Backup & Restore

### Backup Otomatis
```bash
npm run db:backup
```
- Berjalan via cron: setiap hari pukul 02:00 WIB
- Menyimpan snapshot Turso ke file `.turso/backups/`
- TTL: 30 hari

### Restore Drill (Uji Bulanan)
Jalankan script ini setiap bulan untuk memverifikasi backup bisa direstore:
```bash
npm run db:drill-restore -- <snapshot-id>
```
Hasil drill otomatis tercatat di tabel `backup_restore_drills`.

### Restore Manual

**Dari Turso branch:**
```bash
# Buat branch dari snapshot
turso db branch create rumah-keripik restore-<date>

# Jika perlu restore penuh:
# 1. Export dari branch
turso db shell restore-<date> ".dump" > restore.sql
# 2. Import ke produksi
turso db shell rumah-keripik < restore.sql
```

**Dari file backup lokal:**
```bash
# Asumsikan file backup ada di .turso/backups/
turso db shell rumah-keripik < .turso/backups/rumah-keripik-<date>.sql
```

## Kontak & Eskalasi

| Peran | Nama | Kontak |
|---|---|---|
| Pemilik Proyek | Hengki | - |
| Developer | - | - |
| Turso Support | status.turso.tech | support@turso.tech |
| Vercel Support | vercel.com/support | support@vercel.com |

## Catatan Drill

| Tanggal | Snapshot | Hasil | Durasi | Isu |
|---|---|---|---|---|
| - | - | - | - | - |

> Update baris ini setiap kali menjalankan restore drill.
> Detail lengkap ada di tabel `backup_restore_drills`.
