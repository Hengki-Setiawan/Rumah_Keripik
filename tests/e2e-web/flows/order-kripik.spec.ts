import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Order flow', () => {
  test('adds product from starter prompt', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan', { timeout: 30000 });
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /lihat produk/i }).click();
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
