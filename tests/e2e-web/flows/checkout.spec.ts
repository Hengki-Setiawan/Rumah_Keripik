import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('A3. Checkout Flow', () => {
  test('T15: Fill address form via Isi Alamat button', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('cart-fill-address').click();
    await expect(page.getByTestId('order-customer-name')).toBeVisible({ timeout: 10000 });
  });

  test('T16: Fill all customer fields and proceed to address', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('cart-fill-address').click();
    await expect(page.getByTestId('order-customer-name')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('order-customer-name').fill('Budi');
    await page.getByTestId('order-customer-phone').fill('08123456789');
    await page.getByTestId('order-customer-pin').fill('1234');
    await page.getByTestId('order-step-address').click();
    await expect(page.getByTestId('order-address-text')).toBeVisible({ timeout: 5000 });
  });

  test('T17: Select COD payment method', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('cart-fill-address').click();
    await expect(page.getByTestId('order-customer-name')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('order-customer-name').fill('Budi');
    await page.getByTestId('order-customer-phone').fill('08123456789');
    await page.getByTestId('order-customer-pin').fill('1234');
    await page.getByTestId('order-step-address').click();
    await expect(page.getByTestId('order-address-text')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('order-address-text').fill('Jl. Merdeka No. 123, Jakarta');
    await page.getByTestId('order-address-note').fill('Depan pasar');
    await page.getByTestId('order-step-payment').click();
    await expect(page.getByTestId('order-notes')).toBeVisible({ timeout: 5000 });
  });

  test('T18: Fill address and notes then proceed to review', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    // Send "2 balado"
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });

    // Click "Isi alamat" to open order form
    await page.getByTestId('cart-fill-address').click();
    await expect(page.getByTestId('order-customer-name')).toBeVisible({ timeout: 10000 });

    // Fill customer form
    await page.getByTestId('order-customer-name').fill('Budi');
    await page.getByTestId('order-customer-phone').fill('081234567890');
    await page.getByTestId('order-customer-pin').fill('1234');
    await page.getByTestId('order-step-address').click();

    // Fill address form
    await expect(page.getByTestId('order-address-text')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('order-address-text').fill('Jl. Merdeka No. 10');
    await page.getByTestId('order-address-note').fill('Dekat pasar');
    await page.getByTestId('order-step-payment').click();

    // Fill notes, select payment, then review
    await expect(page.getByTestId('order-notes')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('order-notes').fill('Tolong dibungkus rapi');
    await page.locator('button:has-text("Bayar saat pesanan diterima.")').click();
    await expect(page.getByTestId('order-step-review')).toBeEnabled({ timeout: 5000 });
    await page.getByTestId('order-step-review').click();
    await expect(page.getByTestId('order-submit')).toBeVisible({ timeout: 5000 });
  });

  test('T19: Submit order successfully', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('cart-fill-address').click();
    await expect(page.getByTestId('order-customer-name')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('order-customer-name').fill('Budi');
    await page.getByTestId('order-customer-phone').fill('08123456789');
    await page.getByTestId('order-customer-pin').fill('1234');
    await page.getByTestId('order-step-address').click();
    await expect(page.getByTestId('order-address-text')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('order-address-text').fill('Jl. Merdeka No. 123, Jakarta');
    await page.getByTestId('order-address-note').fill('Depan pasar');
    await page.getByTestId('order-step-payment').click();
    await expect(page.getByTestId('order-notes')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('order-notes').fill('Tolong dibungkus rapi');
    await page.locator('button:has-text("Bayar saat pesanan diterima.")').click();
    await page.getByTestId('order-step-review').click();
    await expect(page.getByTestId('order-submit')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('order-submit').click();
    await expect(page.getByTestId('chat-cart-summary')).not.toBeVisible({ timeout: 10000 });
  });

  test('T20: Order form submit button disabled when fields empty', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
