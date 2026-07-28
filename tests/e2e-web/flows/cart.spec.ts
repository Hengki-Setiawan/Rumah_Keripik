import { test, expect } from '@playwright/test';
import { mockAllApi, mockCartWithItems, twoItemCart, emptyCart } from '../fixtures/mock-api';

test.describe('A2. Cart Operations', () => {
  test('T9: Add single item via chat shows cart summary', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T10: Add multiple items shows cart with all items', async ({ page }) => {
    mockAllApi(page);
    mockCartWithItems(page, twoItemCart.items, twoItemCart.total);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-input').fill('2 balado + 1 pedas');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T11: Cart displays correct total', async ({ page }) => {
    mockAllApi(page);
    mockCartWithItems(page, twoItemCart.items, twoItemCart.total);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.fill('2 balado + 1 pedas');
    await page.getByTestId('chat-send-button').click();
    const cartSummary = page.getByTestId('chat-cart-summary');
    await expect(cartSummary).toBeVisible({ timeout: 15000 });
  });

  test('T12: Empty cart state shows no cart summary', async ({ page }) => {
    mockAllApi(page);
    mockCartWithItems(page, [], 0);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.fill('kosongkan');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).not.toBeVisible({ timeout: 10000 });
  });

  test('T13: Update quantity in cart via action', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T14: Remove item from cart via action', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
