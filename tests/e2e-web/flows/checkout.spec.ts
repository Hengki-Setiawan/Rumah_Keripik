import { test, expect } from '@playwright/test';
import { mockAllApi, mockOrderForm } from '../fixtures/mock-api';

test.describe('Checkout', () => {
  test('fills order form and submits', async ({ page }) => {
    mockAllApi(page);
    mockOrderForm(page);
    await page.goto('/pesan');

    const idleComposer = page.getByTestId('chat-composer-idle');
    await idleComposer.waitFor({ state: 'visible', timeout: 20000 });
    const input = idleComposer.getByTestId('chat-input');
    await input.click();
    await input.pressSequentially('2 kripik balado', { delay: 20 });
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
