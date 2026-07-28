import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Smoke', () => {
  test('chat page loads without errors', async ({ page }) => {
    mockAllApi(page);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/pesan', { timeout: 30000 });
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    expect(errors.length).toBe(0);
  });
});
