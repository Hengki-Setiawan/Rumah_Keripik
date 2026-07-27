import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Chat', () => {
  test('loads and shows greeting', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 15000 });
  });

  test('sends message and shows response', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 pedas + COD');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
