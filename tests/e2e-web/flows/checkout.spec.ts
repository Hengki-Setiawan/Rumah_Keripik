import { test, expect } from '@playwright/test';
import { mockAllApi, mockOrderForm } from '../fixtures/mock-api';

test.describe('Checkout', () => {
  test('fills order form and submits', async ({ page }) => {
    mockAllApi(page);
    mockOrderForm(page);
    await page.goto('/pesan');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await page.getByTestId('chat-input').fill('2 kripik balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible();
    await page.getByTestId('cart-fill-address').click();
    await expect(page.getByTestId('order-customer-name')).toBeVisible();
    await page.getByTestId('order-customer-name').fill('Tester');
    await page.getByTestId('order-customer-phone').fill('08123456789');
    await page.getByTestId('order-customer-pin').fill('1234');
    await page.getByTestId('order-step-address').click();
    await expect(page.getByTestId('order-address-text')).toBeVisible();
    await page.getByTestId('order-address-text').fill('Jl. Testing No. 1, Samarinda');
    await page.getByTestId('order-address-note').fill('Dekat masjid');
    await page.getByTestId('order-step-payment').click();
    await expect(page.getByTestId('order-step-review')).toBeVisible();
    await page.getByText(/Bayar di Tempat/i).click();
    await page.getByTestId('order-step-review').click();
    await expect(page.getByTestId('order-submit')).toBeVisible();
    await page.getByTestId('order-submit').click();
    await expect(page.getByText(/pesanan berhasil/i)).toBeVisible();
  });
});
