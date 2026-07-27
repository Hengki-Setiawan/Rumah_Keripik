import { test, expect, type Route } from '@playwright/test';

test.describe('AI Provider Timeout Handling', () => {
  test('should show fallback when all AI providers fail', async ({ page }) => {
    await page.route('**/api/chat**', async (route: Route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'all AI providers unavailable' }),
      });
    });

    await page.goto('/');
    await page.click('text=Pesan');
    await page.fill('[data-testid="chat-input"]', 'test fallback');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('text=asisten sedang terbatas')).toBeVisible({ timeout: 30000 });
  });

  test('should recover after provider transient failure', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/chat', async (route: Route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'transient' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reply: 'Coba keripik pedas atau balado, kak!',
            intent: 'recommend',
            components: [{ type: 'product_card', productId: 1 }],
          }),
        });
      }
    });

    await page.goto('/');
    await page.click('text=Pesan');
    await page.fill('[data-testid="chat-input"]', 'rekomendasi produk');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="tool-call-card"]')).toBeVisible({ timeout: 30000 });
  });
});
