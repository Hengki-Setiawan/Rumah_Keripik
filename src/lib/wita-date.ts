export const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function witaNow(): Date {
  return new Date(Date.now() + WITA_OFFSET_MS);
}

export function witaToday(): string {
  return witaNow().toISOString().slice(0, 10);
}

export function witaDateOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + WITA_OFFSET_MS).toISOString().slice(0, 10);
}

export function witaTodayStartIso(): string {
  const now = witaNow();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - WITA_OFFSET_MS);
  return start.toISOString();
}

// Batas awal hari WITA dalam format yang SAMA dengan kolom waktu tersimpan DB
// (`datetime('now','utc')` => `'YYYY-MM-DD HH:MM:SS'`, spasi, UTC).
// Wajib dipakai untuk perbandingan string terhadap `transaksi.waktu_simpan` /
// `courier_earnings.created_at`, karena ISO `T`/`Z` membandingkan lebih kecil
// dari spasi (0x20 < 0x54) sehingga pesanan pagi (00:00–07:59 WITA) hilang.
export function witaTodayStartDb(): string {
  return witaTodayStartIso().replace('T', ' ').slice(0, 19);
}
