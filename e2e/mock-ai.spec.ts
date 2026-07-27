import { test, expect, type Page, type Route } from '@playwright/test';

function mockChatApi(page: Page) {
  page.route('**/api/chat/action', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  page.route('**/api/chat/sessions', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: [] }) });
  });
  page.route('**/api/chat/state*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessionId: 'CHS-mock-1', state: 'awaiting_input', messages: [{ role: 'assistant', content: 'Halo! Mau pesan keripik apa hari ini?' }], cart: null, customerInfo: null, paymentMethod: null }) });
  });
  page.route('**/api/chat/poll*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', response: 'Siap!' }) });
  });
  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Baik, saya bantu pesankan!', intent: 'create_order', components: [{ type: 'order_form' }] }) });
  });
}

test.describe('Chat with mocked AI', () => {
  test('loads chat page with mocked state', async ({ page }) => {
    mockChatApi(page);
    await page.goto('/pesan', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.getByText(/mau pesan keripik apa hari ini|pesan|chat|keripik/i)).toBeVisible({ timeout: 15000 });
  });

  test('handles AI fallback when all providers are down', async ({ page }) => {
    await page.route('**/api/chat**', async (route: Route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'all AI providers unavailable' }) });
    });
    await page.goto('/pesan', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByTestId('chat-input').first().fill('test fallback', { timeout: 10000 });
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByText(/asisten sedang terbatas|gagal|error|maaf/i)).toBeVisible({ timeout: 15000 });
  });

  test('recovers after transient AI failure', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/chat', async (route: Route) => {
      callCount++;
      if (callCount === 1) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'transient failure' }) }); }
      else { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Rekomendasi: Keripik Pedas, Keripik Balado.', intent: 'recommend', components: [] }) }); }
    });
    await page.goto('/pesan', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByTestId('chat-input').first().fill('rekomendasi', { timeout: 10000 });
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByText(/rekomendasi|keripik|stok/i)).toBeVisible({ timeout: 20000 });
  });

  test('shows error on network failure', async ({ page }) => {
    await page.route('**/api/chat**', async (route: Route) => { await route.abort('connectionrefused'); });
    await page.goto('/pesan', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByTestId('chat-input').first().fill('test', { timeout: 10000 });
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByText(/gagal|error|offline|koneksi|tidak dapat|maaf/i)).toBeVisible({ timeout: 15000 });
  });
});
