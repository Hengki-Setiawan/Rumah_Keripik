import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Katalog', () => {
  test('chat page loads and shows greeting with starter prompts', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');
    await expect(page.getByTestId('chat-idle-container')).toBeVisible();
    await expect(page.getByTestId('chat-starter-lihat-produk')).toBeVisible();
  });
});
