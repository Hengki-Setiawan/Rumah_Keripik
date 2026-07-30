import type { Page, Route } from '@playwright/test';
import { mockGreetingMessage, mockChatSession, mockProducts, mockPaymentMethods } from '../mocks/handlers';

const cartData = { id: 'cart-mock', items: [{ id: 'item-1', productId: 'prod-1', productName: 'Kripik Balado', quantity: 2, unitPrice: 15000 }], itemCount: 1, total: 30000 };

export function makeChatResponse(overrides?: { messages?: any[]; cart?: any; stage?: string }) {
  return {
    ok: true,
    messages: overrides?.messages ?? [
      { role: 'user', content: '', createdAt: new Date().toISOString() },
      { role: 'assistant', content: 'Baik, saya bantu pesankan!', createdAt: new Date().toISOString(), components: [{ type: 'cart_summary', cartId: 'cart-mock' }] },
    ],
    cart: overrides?.cart ?? cartData,
    stage: overrides?.stage ?? 'awaiting_address',
  };
}

export const twoItemCart = {
  id: 'cart-two',
  items: [
    { id: 'item-1', productId: 'prod-1', productName: 'Kripik Balado', quantity: 2, unitPrice: 15000 },
    { id: 'item-2', productId: 'prod-3', productName: 'Kripik Pedas', quantity: 1, unitPrice: 14000 },
  ],
  itemCount: 2,
  total: 44000,
};

export const emptyCart = { id: 'cart-empty', items: [], itemCount: 0, total: 0 };

export async function mockAllApi(page: Page) {
  page.route('**/api/customer/session', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true, chatSession: mockChatSession, messages: [mockGreetingMessage], cart: null, customerContext: null,
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
    const req: Record<string, unknown> = JSON.parse(route.request().postData() || '{}');
    if (req.action === 'update_cart') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [{ role: 'assistant', content: 'Kuantitas diperbarui!', createdAt: new Date().toISOString(), components: [{ type: 'cart_summary', cartId: 'cart-mock' }] }], cart: cartData, stage: 'awaiting_address' }) });
    } else if (req.action === 'remove_item') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [{ role: 'assistant', content: 'Item dihapus!', createdAt: new Date().toISOString(), components: [] }], cart: emptyCart, stage: 'awaiting_address' }) });
    } else if (req.action === 'set_payment_method') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [{ role: 'assistant', content: 'Pembayaran dipilih!', createdAt: new Date().toISOString(), components: [] }], cart: cartData, stage: 'awaiting_address' }) });
    } else if (req.action === 'request_location') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [{ role: 'assistant', content: 'Silakan isi data pengiriman:', createdAt: new Date().toISOString(), components: [{ type: 'order_summary', orderDraftId: 'draft-001' }] }], cart: cartData, stage: 'awaiting_address' }) });
    } else if (req.action === 'create_order') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [{ role: 'assistant', content: 'Pesanan berhasil dibuat!', createdAt: new Date().toISOString(), components: [{ type: 'order_confirmation', orderCode: 'MOCK-001' }] }], cart: null, stage: 'completed' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [mockGreetingMessage], cart: null, stage: 'idle' }) });
    }
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
      body: JSON.stringify(makeChatResponse({
        messages: [
          { role: 'user', content: req.message || '', createdAt: new Date().toISOString() },
          { role: 'assistant', content: 'Baik, saya bantu pesankan! Silakan isi data pengiriman ya kak!', createdAt: new Date().toISOString(), components: [{ type: 'cart_summary', cartId: 'cart-mock' }] },
        ],
      })),
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

export async function mockIdleSession(page: Page) {
  page.route('**/api/customer/session', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true, chatSession: { ...mockChatSession, stage: 'idle' }, messages: [], cart: null, customerContext: null,
      }),
    });
  });
}

let pollCount = 0;
export async function mockPollReturnsNewMessage(page: Page) {
  pollCount = 0;
  page.route('**/api/chat/poll*', async (route: Route) => {
    pollCount++;
    if (pollCount >= 3) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, changed: true, messages: [{ role: 'assistant', content: 'Ada pesan baru!', createdAt: new Date().toISOString() }] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, changed: false }) });
    }
  });
}

export async function mockChatDelayed(page: Page) {
  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeChatResponse({ messages: [{ role: 'assistant', content: 'Respon lambat', createdAt: new Date().toISOString() }] })) });
  });
}

export async function mockChatError(page: Page) {
  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Gagal memproses pesan' }) });
  });
}

export async function mockCartWithItems(page: Page, items: any[], total: number) {
  page.route('**/api/chat', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeChatResponse({
      messages: [
        { role: 'assistant', content: 'Ini ringkasan keranjang kak!', createdAt: new Date().toISOString(), components: [{ type: 'cart_summary', cartId: 'cart-mock' }] },
      ],
      cart: { id: 'cart-custom', items, itemCount: items.length, total },
    })) });
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
          messages: [{ role: 'assistant', content: 'Pesanan berhasil dibuat! Terima kasih kak!', createdAt: new Date().toISOString(), components: [{ type: 'order_confirmation', orderCode: 'MOCK-001' }] }],
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [mockGreetingMessage], cart: null, stage: 'idle' }) });
    }
  });
}
