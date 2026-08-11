import { expect, type Page, type Route } from '@playwright/test';
import { mockGreetingMessage, mockChatSession, mockProducts, mockPaymentMethods } from '../mocks/handlers';

const cartData = { id: 'cart-mock', items: [{ id: 'item-1', productId: 'prod-1', productName: 'Kripik Balado', quantity: 2, unitPrice: 15000 }], itemCount: 1, total: 30000 };

export async function mockAllApi(page: Page) {
  page.route('**/api/customer/session', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true, chatSession: mockChatSession, messages: [], cart: null, customerContext: null,
      }),
    });
  });

  page.route('**/api/chat/sessions', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, sessions: [] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
  });

  page.route('**/api/chat/action', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true, messages: [mockGreetingMessage], cart: null, stage: 'idle',
      }),
    });
  });

  page.route('**/api/chat/poll*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, changed: false }) });
  });

  page.route('**/api/chat/state*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [], cart: null, stage: 'idle' }) });
  });

  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    const req = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        messages: [
          { role: 'user', content: req.message || '', createdAt: new Date().toISOString() },
          { role: 'assistant', content: 'Baik, saya bantu pesankan! Silakan isi data pengiriman ya kak!', createdAt: new Date().toISOString(), components: [{ type: 'cart_summary', cartId: 'cart-mock' }] },
        ],
        cart: cartData,
        stage: 'awaiting_address',
      }),
    });
  });

  page.route('**/api/public/products', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, products: mockProducts }) });
  });

  page.route('**/api/public/payment-methods', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, methods: mockPaymentMethods }) });
  });

  page.route('**/api/public/categories', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categories: [] }) });
  });

  page.route('**/api/public/saved-addresses', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, addresses: [] }) });
  });

  page.route('**/api/public/me', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'not_logged_in' }) });
  });
}

export async function mockCartResponse(page: Page) {
  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        messages: [
          { role: 'assistant', content: 'Ini ringkasan keranjang kak!', createdAt: new Date().toISOString(), components: [{ type: 'cart_summary', cartId: 'cart-mock' }] },
        ],
        cart: cartData,
        stage: 'awaiting_address',
      }),
    });
  });
}

export async function mockOrderForm(page: Page) {
  page.route('**/api/chat/action', async (route: Route) => {
    const req = JSON.parse(route.request().postData() || '{}');
    if (req.action === 'create_order') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          messages: [{ role: 'assistant', content: 'Pesanan berhasil dibuat! Terima kasih kak!', createdAt: new Date().toISOString(), components: [] }],
          cart: null, stage: 'completed',
        }),
      });
    } else if (req.action === 'request_location') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          messages: [{ role: 'assistant', content: 'Silakan isi data pengiriman:', createdAt: new Date().toISOString(), components: [{ type: 'order_summary', orderDraftId: 'draft-001' }] }],
          cart: cartData, stage: 'awaiting_address',
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true, messages: [mockGreetingMessage], cart: null, stage: 'idle',
        }),
      });
    }
  });
}
