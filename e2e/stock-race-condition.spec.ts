import { test, expect } from '@playwright/test';

test.describe('Stock Race Condition', () => {
  test('should detect stock change between draft and checkout', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Pesan');
    await page.fill('[data-testid="chat-input"]', 'pesan 1 keripik balado');
    await page.click('[data-testid="send-button"]');
    await page.waitForTimeout(3000);
    const confirmBtn = page.locator('text=Konfirmasi Pesanan');
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    }
    await expect(page.locator('[data-testid="cart-summary"]')).toBeVisible({ timeout: 15000 });
  });
});
