import { expect, test } from '@playwright/test';

function randomPhone() {
  const suffix = `${Date.now()}`.slice(-8);
  return `0813${suffix}`;
}

test.describe('E2E Midtrans QRIS Flow', () => {
  test('Pembeli dapat membuat pesanan online dan melihat QRIS Midtrans secara langsung di chat', async ({ page }) => {
    const phone = randomPhone();

    // 1. Masuk ke halaman chat
    await page.goto('/pesan');
    await expect(page.getByText(/mau pesan keripik apa hari ini/i).first()).toBeVisible();

    // 2. Chat AI untuk memesan produk
    await page.locator('[data-testid="chat-input"], textarea[placeholder*="Tanya stok"]').first().fill('Saya mau pesan 1 keripik pedas dan bayar online');
    await page.getByRole('button', { name: /kirim pesan/i }).click();

    // 3. Tunggu respon AI dan kemunculan form order
    await expect(page.getByText(/buat order dari chat|ringkasan keranjang|pilih metode pembayaran/i).first()).toBeVisible();

    // 4. Isi Form Pemesan
    await page.locator('[data-testid="order-customer-name"], input[placeholder*="Nama penerima"]').first().fill('Tester Midtrans QRIS');
    await page.locator('[data-testid="order-customer-phone"], input[placeholder*="WhatsApp"]').first().fill(phone);
    await page.locator('[data-testid="order-customer-pin"], input[placeholder*="PIN"]').first().fill('1234');
    await page.getByRole('button', { name: /lanjut alamat/i }).click();

    // 5. Isi Alamat
    await page.locator('[data-testid="order-address-text"], textarea[placeholder*="Alamat lengkap"]').first().fill('Jl. Kemakmuran No. 45, Samarinda');
    await page.locator('[data-testid="order-address-note"], input[placeholder*="Patokan"], input[placeholder*="kurir"]').first().fill('Seberang indomaret');
    await page.getByRole('button', { name: /lanjut pembayaran/i }).click();

    // 6. Pilih Pembayaran Online (bukan COD)
    const onlineButton = page.locator('[data-testid^="payment-method-"], button').filter({ hasText: /bayar online/i }).first();
    await expect(onlineButton).toBeVisible();
    await onlineButton.click();

    // 7. Lanjut ke review dan konfirmasi order
    await page.locator('[data-testid="order-notes"], textarea[placeholder*="Catatan pesanan"]').first().fill('E2E Test QRIS Direct');
    await page.getByRole('button', { name: /review order/i }).click();
    await page.getByRole('button', { name: /konfirmasi .*buat order|konfirmasi & buat order/i }).click();

    // 8. Verifikasi bahwa pesanan berhasil dibuat dan gambar QRIS langsung terender di obrolan
    await expect(page.getByText(/order berhasil dibuat/i).first()).toBeVisible();
    
    // Verifikasi keberadaan gambar QRIS Midtrans
    const qrisImage = page.locator('img[alt="QRIS Midtrans"]');
    await expect(qrisImage).toBeVisible();

    // Verifikasi tombol "Saya Sudah Bayar" dan "Buka Pesanan Saya"
    const confirmButton = page.getByRole('button', { name: /saya sudah bayar/i });
    await expect(confirmButton).toBeVisible();

    // 9. Buka halaman status pesanan dan verifikasi QRIS di sana juga
    const statusUrlLink = page.getByRole('link', { name: /lihat status/i }).first();
    if (await statusUrlLink.count() > 0) {
      await statusUrlLink.click();
      await expect(page).toHaveURL(/\/pesan\/status\//);
      
      // Verifikasi gambar QRIS di halaman status
      const statusQrisImage = page.locator('img[alt="QRIS Midtrans"]');
      await expect(statusQrisImage).toBeVisible();
    }
  });
});
