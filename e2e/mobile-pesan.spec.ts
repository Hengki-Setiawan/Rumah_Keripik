import { expect, test } from '@playwright/test';

test.describe('Mobile /pesan smoke', () => {
  test('halaman chat tampil dan komposer bisa diketik di viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pesan');

    await expect(page.getByText(/mau pesan keripik apa hari ini/i)).toBeVisible({ timeout: 15000 });

    const input = page.locator('[data-testid="chat-input"], textarea[placeholder*="Tanya stok"]').first();
    await expect(input).toBeVisible();
    await input.fill('2 pedas');

    const sendButton = page.getByRole('button', { name: /kirim pesan/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page.getByText(/ringkasan keranjang|keranjang|order/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('starter prompt buttons tetap accessible di mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pesan');

    const lihatProduk = page.getByRole('button', { name: /lihat produk/i });
    await expect(lihatProduk).toBeVisible();
    await lihatProduk.click();

    const cartButton = page.locator('[data-testid^="add-to-cart-"]').first();
    await expect(cartButton).toBeVisible();
  });

  test('payment proof upload card tidak overflow di mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pesan/saya');

    await expect(page.locator('body')).toBeVisible();
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);

    const uploadCard = page.locator('[data-testid="payment-upload-card"], [class*="payment"]').first();
    if (await uploadCard.isVisible()) {
      const box = await uploadCard.boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width + 10);
      }
    }
  });
});
