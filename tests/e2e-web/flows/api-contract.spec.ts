import { test, expect } from '@playwright/test';

// ============================================================================
// L1 — API CONTRACT TESTS (Playwright request fixture, NO browser).
// Fast (50-200ms) health/contract checks against prod. Fails only when the
// API itself is broken — never flaky, no UI layer.
// Run with: npx playwright test --config=playwright.prod.config.ts
// ============================================================================

test.describe('L1 API contracts (prod)', () => {
  test('products catalog is reachable and well-formed', async ({ request }) => {
    const res = await request.get('/api/public/products');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);
    const first = body.products[0];
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
    expect(Number(first.price)).toBeGreaterThan(0);
  });

  test('customer session and chat sessions endpoints respond', async ({ request }) => {
    const customer = await request.post('/api/customer/session');
    expect(customer.ok()).toBeTruthy();
    const customerBody = await customer.json();
    expect(customerBody.ok).toBe(true);
    expect(customerBody.chatSession?.id).toBeTruthy();

    const sessions = await request.get('/api/chat/sessions');
    expect(sessions.ok()).toBeTruthy();
    const body = await sessions.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  test('chat session bootstrap persists a cookie for owned requests', async ({ request }) => {
    const res = await request.post('/api/customer/session');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.chatSession?.id).toBeTruthy();

    const action = await request.post('/api/chat/action', {
      data: { chatSessionId: body.chatSession.id, action: 'refresh_chat', payload: {} },
    });
    expect(action.ok()).toBeTruthy();
    const actionBody = await action.json();
    expect(actionBody.ok).toBe(true);
  });

  test('courier incidents route is live and requires auth (401)', async ({ request }) => {
    const res = await request.get('/api/courier/incidents');
    expect(res.status()).toBe(401);
  });

  test('admin protected route rejects anonymous request (401/403)', async ({ request }) => {
    const res = await request.get('/api/admin/couriers');
    expect([401, 403]).toContain(res.status());
  });
});
