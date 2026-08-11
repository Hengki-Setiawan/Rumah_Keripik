import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test('debug wait for active composer before fill', async ({ page }) => {
  mockAllApi(page);

  await page.goto('/pesan');

  const active = page.getByTestId('chat-composer');
  await expect(active).toBeVisible({ timeout: 20000 });
  console.log('active composer visible');

  const input = page.getByTestId('chat-input');
  await input.fill('2 kripik balado');
  console.log('value after fill:', JSON.stringify(await input.inputValue()));
  await expect(page.getByTestId('chat-send-button')).toBeEnabled({ timeout: 5000 });
  console.log('send button enabled');
});
