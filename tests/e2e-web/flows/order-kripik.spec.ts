import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Order flow', () => {
  test('sends order via chat input', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const idleComposer = page.getByTestId('chat-composer-idle');
    await idleComposer.waitFor({ state: 'visible', timeout: 20000 });
    const input = idleComposer.getByTestId('chat-input');
    await input.click();
    await input.pressSequentially('1 kripik original', { delay: 20 });
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});