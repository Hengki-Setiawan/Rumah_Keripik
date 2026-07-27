import { test, expect, type Page, type Route } from '@playwright/test';

function mockChatApi(page: Page) {
  const sessions = new Map<string, { messages: Array<{ role: string; content: string }> }>();
  let sessionCounter = 0;

  page.route('**/api/chat/action', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, action: 'acknowledged' }),
    });
  });

  page.route('**/api/chat/sessions', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: Array.from(sessions.entries()).map(([id, s]) => ({
            id,
            preview: s.messages[0]?.content?.slice(0, 50) || 'Chat baru',
            messageCount: s.messages.length,
            createdAt: new Date().toISOString(),
          })),
        }),
      });
    } else {
      const body = JSON.parse(route.request().postData() || '{}');
      const newId = `CHS-mock-${++sessionCounter}`;
      sessions.set(newId, { messages: [{ role: 'user', content: body.message || '' }] });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: newId }),
      });
    }
  });

  page.route('**/api/chat/state*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 'CHS-mock-1',
        state: 'awaiting_input',
        messages: [
          { role: 'assistant', content: 'Halo! Mau pesan keripik apa hari ini?' },
        ],
        cart: null,
        customerInfo: null,
        paymentMethod: null,
      }),
    });
  });

  page.route('**/api/chat/poll*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ready', response: 'Pesanan kamu sudah siap, kak!' }),
    });
  });

  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'Baik, saya bantu pesankan 2 keripik pedas. Silakan isi data pengiriman ya kak!',
        intent: 'create_order',
        components: [{ type: 'order_form' }],
      }),
    });
  });
}

test.describe('Chat with mocked AI', () => {
  test('loads chat page with mocked state', async ({ page }) => {
    mockChatApi(page);
    await page.goto('/pesan');
    await expect(page.getByText(/mau pesan keripik apa hari ini/i)).toBeVisible();
  });

  test('handles AI fallback gracefully when all providers are down', async ({ page }) => {
    await page.route('**/api/chat**', async (route: Route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'all AI providers unavailable' }),
      });
    });

    await page.goto('/pesan');
    await page.locator('[data-testid="chat-input"]').first().fill('test fallback');
    await page.getByRole('button', { name: /kirim pesan/i }).click();
    await expect(page.getByText(/asisten sedang terbatas|gagal|error|maaf/i)).toBeVisible({ timeout: 15000 });
  });

  test('recovers after transient AI failure', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/chat', async (route: Route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'transient failure' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reply: 'Rekomendasi produk: Keripik Pedas, Keripik Balado, Stik Keju.',
            intent: 'recommend',
            components: [],
          }),
        });
      }
    });

    await page.goto('/pesan');
    await page.locator('[data-testid="chat-input"]').first().fill('rekomendasi produk');
    await page.getByRole('button', { name: /kirim pesan/i }).click();
    await expect(page.getByText(/rekomendasi|keripik|stok/i)).toBeVisible({ timeout: 20000 });
  });

  test('shows error state gracefully on network failure', async ({ page }) => {
    await page.route('**/api/chat**', async (route: Route) => {
      await route.abort('connectionrefused');
    });

    await page.goto('/pesan');
    await page.locator('[data-testid="chat-input"]').first().fill('test network fail');
    await page.getByRole('button', { name: /kirim pesan/i }).click();
    await expect(page.getByText(/gagal|error|offline|koneksi|tidak dapat|maaf/i)).toBeVisible({ timeout: 15000 });
  });
});
