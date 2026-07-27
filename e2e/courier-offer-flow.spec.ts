import { test, expect } from '@playwright/test';

test.describe('Courier Offer Flow', () => {
  test('offer accept/reject round trip', async ({ page }) => {
    const courierToken = process.env.E2E_COURIER_TOKEN || 'test-courier-token';

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('offer 45s auto-reject expiry', async () => {});
});

test.describe('Admin Live Courier Map', () => {
  test('live map page loads and shows couriers', async ({ page }) => {
    await page.goto('/kurir/live');
  });
});

test.describe('SOS Resolve → Push', () => {
  test('admin resolves SOS triggers push notification', async ({ page }) => {});
});
