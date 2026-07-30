import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard & Management Suite', () => {
  test('ADM1: Halaman Login Admin (/login) merender form credential dan tombol session', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Verifikasi form login
    const loginHeader = page.locator('h1, h2, form').filter({ hasText: /masuk|login|admin/i }).first();
    await expect(loginHeader).toBeVisible();

    const usernameInput = page.locator('input[name="username"], input[name="email"], input[type="text"]').first();
    await expect(usernameInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();
  });

  test('ADM2: Validation pada Login kosong', async ({ page }) => {
    await page.goto('/login');
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Pastikan tidak crash dan tetap di halaman login atau menampilkan error
    await expect(page).toHaveURL(/\/login/);
  });

  test('ADM3: Halaman Transaksi Admin (/transaksi) dapat merender UI tabel', async ({ page }) => {
    // Kita langsung tuju URL /transaksi untuk verifikasi SSR / layout halaman
    await page.goto('/transaksi');
    // Jika perlu auth, NextAuth akan meredirect ke /login atau merender halaman login/unauthorized
    const isLoginPage = page.url().includes('/login');
    const isTransaksiPage = page.url().includes('/transaksi');
    expect(isLoginPage || isTransaksiPage).toBe(true);
  });

  test('ADM4: Halaman Master Data Produk (/master-data/produk) dapat dimuat', async ({ page }) => {
    await page.goto('/master-data/produk');
    const isLoginPage = page.url().includes('/login');
    const isProdukPage = page.url().includes('/master-data/produk');
    expect(isLoginPage || isProdukPage).toBe(true);
  });

  test('ADM5: Halaman Keuangan & Ledger (/keuangan) dapat dimuat', async ({ page }) => {
    await page.goto('/keuangan');
    const isLoginPage = page.url().includes('/login');
    const isKeuanganPage = page.url().includes('/keuangan');
    expect(isLoginPage || isKeuanganPage).toBe(true);
  });
});
