import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Chat', () => {
  test('loads and shows greeting', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('chat-send-button')).toBeVisible();
  });

  test('sends message and shows response', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('chat-input').pressSequentially('2 pedas + COD');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
