import { test, expect } from '@playwright/test';

test.describe('Halaman Pelanggan & Customer Facing Suite', () => {
  test('C1: Halaman Pelacakan Pesanan (/pesan/lacak) meredirect dengan mulus ke Pesanan Saya (/pesan/saya)', async ({ page }) => {
    await page.goto('/pesan/lacak');
    await expect(page).toHaveURL(/\/pesan\/saya/);
    
    // Verifikasi heading atau bagian profil
    const profileHeader = page.locator('h1, h2, header, div').filter({ hasText: /pesanan saya|profil|riwayat|lacak/i }).first();
    await expect(profileHeader).toBeVisible();
  });

  test('C2: Halaman Profil & Pesanan Saya (/pesan/saya) dapat dimuat', async ({ page }) => {
    await page.goto('/pesan/saya');
    await expect(page).toHaveURL(/\/pesan\/saya/);
    
    // Verifikasi heading atau bagian profil
    const profileHeader = page.locator('h1, h2, header, div').filter({ hasText: /pesanan saya|profil|riwayat/i }).first();
    await expect(profileHeader).toBeVisible();
  });

  test('C3: Halaman Kebijakan Privasi (/pesan/kebijakan-privasi) dapat dimuat dengan baik', async ({ page }) => {
    await page.goto('/pesan/kebijakan-privasi');
    await expect(page).toHaveURL(/\/pesan\/kebijakan-privasi/);
    
    // Verifikasi konten teks kebijakan privasi
    const privacyTitle = page.locator('h1, h2, main, div').filter({ hasText: /kebijakan privasi|privasi|ketentuan/i }).first();
    await expect(privacyTitle).toBeVisible();
  });

  test('C4: Halaman Program Loyalty & Poin (/loyalty) dapat dimuat', async ({ page }) => {
    await page.goto('/loyalty');
    await expect(page).toHaveURL(/\/loyalty/);
    
    // Verifikasi elemen loyalty / poin / tier
    const loyaltyHeader = page.locator('h1, h2, div, main').filter({ hasText: /loyalty|poin|tier|reward|pelanggan/i }).first();
    await expect(loyaltyHeader).toBeVisible();
  });
});
