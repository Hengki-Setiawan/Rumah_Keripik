import { test, expect } from '@playwright/test';
import { mockAllApi, mockIdleSession, mockChatDelayed, mockPollReturnsNewMessage } from '../fixtures/mock-api';

test.describe('A1. Happy Path — Chat', () => {
  test('T1: Page loads with greeting', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const sendButton = page.getByTestId('chat-send-button');
    await expect(sendButton).toBeVisible({ timeout: 15000 });
    await expect(sendButton).toBeDisabled();
  });

  test('T2: Send message via textarea', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T3: Send via Enter key', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('1 original');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T4: Multiple messages in conversation', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByTestId('chat-input').fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('chat-input').fill('1 original');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible();
  });

  test('T5: Chat shows loading indicator while sending', async ({ page }) => {
    mockAllApi(page);
    mockChatDelayed(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('2 balado');

    const sendButton = page.getByTestId('chat-send-button');
    await sendButton.click();
    await expect(sendButton).toBeDisabled({ timeout: 3000 });
  });

  test('T6: Starter prompts visible when idle', async ({ page }) => {
    mockAllApi(page);
    mockIdleSession(page);
    await page.goto('/pesan');
    await expect(page.getByTestId('chat-idle-container')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('chat-starter-lihat-produk')).toBeVisible();
    await expect(page.getByTestId('chat-starter-rekomendasi-pedas')).toBeVisible();
    await expect(page.getByTestId('chat-starter-cek-pesanan')).toBeVisible();
  });

  test('T7: Click starter prompt sends a message', async ({ page }) => {
    mockAllApi(page);
    mockIdleSession(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-starter-lihat-produk').waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => {
      (document.querySelector('[data-testid="chat-starter-lihat-produk"]') as HTMLButtonElement)?.click();
    });
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 15000 });
  });

  test('T8: Polling updates chat with new message', async ({ page }) => {
    mockAllApi(page);
    mockPollReturnsNewMessage(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('chat-input').fill('cek pesanan');
    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });
});
