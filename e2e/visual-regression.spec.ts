import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('home page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="live-clock"], .live-clock, [class*="clock"]')],
    });
  });

  test('chat page matches snapshot', async ({ page }) => {
    await page.goto('/pesan');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('chat-page.png', {
      fullPage: true,
    });
  });

  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
    });
  });
});
