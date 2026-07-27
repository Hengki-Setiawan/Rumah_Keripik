<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:memory-system -->
# Memory System

BACA file `../.opencode/memory.md` sebelum memulai tugas.
UPDATE file `../.opencode/memory.md` di akhir sesi dengan state terbaru.
<!-- END:memory-system -->

<!-- BEGIN:testing-conventions -->
# Testing Conventions

## Playwright Testing Rules
- Selalu gunakan `page.getByTestId('nama-elemen')`. JANGAN gunakan selector CSS/class/text kecuali tidak ada pilihan lain.
- Setiap komponen baru WAJIB diberi `data-testid` sesuai konvensi: `[nama-fitur]-[elemen]`, contoh: `checkout-submit-button`.
- JANGAN pernah pakai `page.waitForTimeout()`. Gunakan auto-wait bawaan Playwright (`expect(locator).toBeVisible()`, dll).
- Semua test HARUS independen (tidak boleh saling bergantung urutan run).
- Mock semua external API (payment gateway, ongkir/shipping API, email) menggunakan `page.route()` — JANGAN hit API asli saat test.
- Simpan data uji di `tests/e2e-web/fixtures/`, jangan hardcode di dalam spec file.

## Maestro Testing Rules (Mobile & Courier)
- Prioritaskan `id:` (testID/accessibilityId) daripada teks, supaya tahan perubahan copy/UI.
- Setiap flow HARUS bisa jalan dari kondisi app fresh-install (jangan asumsi state sebelumnya).
- Mock backend API mobile dengan mock server lokal — jangan hit backend produksi.
- Simpan flow reusable (login, navigasi) di `tests/e2e-mobile/flows/subflows/` dan panggil pakai `runFlow`.
<!-- END:testing-conventions -->
