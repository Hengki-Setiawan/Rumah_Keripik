import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Katalog', () => {
  test('chat page loads and shows starter prompts', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });

    await expect(page.getByTestId('header-my-orders')).toBeVisible();
    await expect(page.getByTestId('header-new-order')).toBeVisible();
  });
});
