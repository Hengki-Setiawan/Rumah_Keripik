import { test, expect } from '@playwright/test';

test.describe('AI Provider Timeout Handling', () => {
  test('should show fallback when all AI providers fail', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Pesan');
    await page.fill('[data-testid="chat-input"]', 'test fallback');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('text=asisten sedang terbatas')).toBeVisible({ timeout: 30000 });
  });

  test('should recover after provider transient failure', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Pesan');
    await page.fill('[data-testid="chat-input"]', 'rekomendasi produk');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="tool-call-card"]')).toBeVisible({ timeout: 30000 });
  });
});
