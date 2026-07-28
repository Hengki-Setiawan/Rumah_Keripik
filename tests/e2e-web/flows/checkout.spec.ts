import { test, expect } from '@playwright/test';
import { mockAllApi, mockOrderForm } from '../fixtures/mock-api';

test.describe('Checkout', () => {
  test('fills order form and submits', async ({ page }) => {
    mockAllApi(page);
    mockOrderForm(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.click();
    await input.fill('2 kripik balado');

    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
