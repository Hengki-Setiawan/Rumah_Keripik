import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Order flow', () => {
  test('sends order via chat input', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('chat-input').pressSequentially('1 kripik original');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
