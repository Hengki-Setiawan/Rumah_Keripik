import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Chat', () => {
  test('loads and shows greeting', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.getByTestId('chat-send-button')).toBeVisible();
  });

  test('sends message and shows response', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const idleComposer = page.getByTestId('chat-composer-idle');
    await idleComposer.waitFor({ state: 'visible', timeout: 20000 });
    const input = idleComposer.getByTestId('chat-input');
    await input.click();
    await input.pressSequentially('2 pedas + COD', { delay: 20 });
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});