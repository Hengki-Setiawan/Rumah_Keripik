import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Cart', () => {
  test('send message and see cart summary', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('chat-input').pressSequentially('2 kripik balado');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
