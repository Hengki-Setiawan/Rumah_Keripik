# Chat & Data Retention Policy

## Data yang dikumpulkan
- Riwayat percakapan chat (termasuk intent, produk yang dilihat, keranjang)
- Customer profile (nama, nomor WA, alamat pengiriman)
- Log AI (provider, model, token usage, latency) — anonim, tidak berisi PII

## Retensi
| Data | Durasi | Alasan |
|---|---|---|
| Riwayat chat aktif | 90 hari sejak percakapan terakhir | Customer service & dispute resolution |
| Riwayat chat selesai (order completed) | 365 hari | Garansi & return |
| Customer profile | Selama akun aktif + 2 tahun | Regulasi pembukuan |
| AI log | 30 hari rolling | Budget monitoring & debugging |
| Failed conversation | 90 hari | Quality improvement |

## Penghapusan
- Penghapusan akun: hapus profile + anonimisasi riwayat chat dalam 30 hari
- Chat individual: request ke admin via chat atau email
- Batch cleanup otomatis: cron `cleanup-expired-chats` berjalan setiap minggu 03:00

## Keamanan
- Data chat hanya bisa diakses oleh admin dengan role `customer_support` atau `owner`
- AI log tidak berisi pesan asli user — hanya metadata teknis
- Enkripsi in-transit (TLS) dan at-rest (Turso encryption)