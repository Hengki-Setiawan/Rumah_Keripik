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

    await page.goto('/pesan');
    await page.getByTestId('chat-input').first().fill('test fallback');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByText(/asisten sedang terbatas|gagal|error|maaf/i)).toBeVisible({ timeout: 30000 });
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

    await page.goto('/pesan');
    await page.getByTestId('chat-input').first().fill('rekomendasi produk');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByText(/rekomendasi|keripik|stok/i)).toBeVisible({ timeout: 20000 });
  });
});
