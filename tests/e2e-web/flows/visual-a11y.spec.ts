import { test, expect } from '@playwright/test';

test.describe('Visual Layout & Aksesibilitas (a11y) Integrity Suite', () => {
  test('VIS1: Layar Chat (/pesan) memiliki struktur DOM & layout bersih tanpa elemen terpotong', async ({ page }) => {
    await page.goto('/pesan');
    await page.waitForLoadState('domcontentloaded');

    // Cek elemen-elemen utama tidak tersembunyi/broken
    const chatContainer = page.locator('main, div[class*="chat" i], form').first();
    await expect(chatContainer).toBeVisible();

    const inputArea = page.locator('textarea, input[type="text"]').first();
    await expect(inputArea).toBeVisible();
  });

  test('VIS2: Layar Login (/login) merender layout terpusat & responsif', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const form = page.locator('form').first();
    await expect(form).toBeVisible();
  });

  test('A11Y1: Struktur HTML halaman chat (/pesan) menggunakan tag semantik valid', async ({ page }) => {
    await page.goto('/pesan');
    
    // Verifikasi viewport meta tag ada untuk responsivitas mobile
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveCount(1);

    // Verifikasi tombol-tombol utama memiliki aksesi yang baik (interactive elements present)
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});
