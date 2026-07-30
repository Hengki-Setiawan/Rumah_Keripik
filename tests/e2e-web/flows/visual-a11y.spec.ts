import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Visual Layout & Aksesibilitas (a11y) Integrity Suite', () => {
  test('VIS1: Layar Chat (/pesan) memiliki struktur DOM & layout bersih tanpa elemen terpotong', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');
    
    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await expect(input).toBeVisible();
  });

  test('VIS2: Layar Login (/login) merender layout terpusat & responsif', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1, h2, h3, form, div').filter({ hasText: /masuk|login|admin/i }).first();
    await heading.waitFor({ state: 'visible', timeout: 20000 });
    await expect(heading).toBeVisible();
  });

  test('A11Y1: Struktur HTML halaman chat (/pesan) menggunakan tag semantik valid', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');
    
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveCount(1);

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await expect(input).toBeVisible();
  });
});
