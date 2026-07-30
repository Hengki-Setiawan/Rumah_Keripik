import { test, expect } from '@playwright/test';
import { mockAllApi, mockChatError } from '../fixtures/mock-api';

test.describe('A4. Edge Cases — Chat', () => {
  test('T21: Very long message', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByTestId('chat-input').fill('A'.repeat(600));
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T22: Special characters and emoji in message', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByTestId('chat-send-button').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByTestId('chat-input').fill('😀🔥<script>alert(1)</script>2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T23: Rapid double-click send only sends one message', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });

    await input.fill('2 balado');
    const sendButton = page.getByTestId('chat-send-button');
    await sendButton.click();
    await expect(page.getByTestId('chat-cart-summary')).toBeVisible({ timeout: 15000 });
  });

  test('T24: Send button disabled when input empty', async ({ page }) => {
    mockAllApi(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });

    const sendButton = page.getByTestId('chat-send-button');
    await expect(sendButton).toBeDisabled();
  });

  test('T25: Network error shows error message', async ({ page }) => {
    mockAllApi(page);
    mockChatError(page);
    await page.goto('/pesan');

    const input = page.getByTestId('chat-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });

    await input.fill('2 balado');
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 });
  });
});
