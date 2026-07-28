import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Order flow', () => {
  test('sends order via chat input', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.fill('1 kripik original');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
