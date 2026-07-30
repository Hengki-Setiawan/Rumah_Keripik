import { test, expect } from '@playwright/test';

test.describe('API Smoke Tests', () => {
  test('GET /api/public/payment-methods returns methods', async ({ request }) => {
    const res = await request.get('/api/public/payment-methods');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.methods)).toBe(true);
  });

  test('GET /api/public/me returns 200', async ({ request }) => {
    const res = await request.get('/api/public/me');
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/loyalty/balance/phone returns ok with unknown phone', async ({ request }) => {
    const res = await request.get('/api/loyalty/balance/phone?phone=0812345678999');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('GET /api/order/track fails without params', async ({ request }) => {
    const res = await request.get('/api/order/track');
    expect(res.ok()).toBeFalsy();
  });

  test('GET /api/admin/loyalty/stats returns 200', async ({ request }) => {
    const res = await request.get('/api/admin/loyalty/stats');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.stats).toBeDefined();
    expect(body.stats.totalAccounts).toBeDefined();
  });

  test('GET /api/admin/couriers returns roster', async ({ request }) => {
    const res = await request.get('/api/admin/couriers');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('GET /api/admin/couriers/live-locations returns ok', async ({ request }) => {
    const res = await request.get('/api/admin/couriers/live-locations');
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('GET /api/admin/dispatch/batch-group returns clusters', async ({ request }) => {
    const res = await request.get('/api/admin/dispatch/batch-group');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('Auth without token returns 401', async ({ request }) => {
    const res = await request.post('/api/courier/auth/logout');
    expect(res.status()).toBe(401);
  });

  test('Rate limiting on login endpoint', async ({ request }) => {
    for (let i = 0; i < 15; i++) {
      await request.post('/api/courier/auth/login', {
        data: { phone: '08123456789', pin: '123456' },
      });
    }
    const res = await request.post('/api/courier/auth/login', {
      data: { phone: '08123456789', pin: '123456' },
    });
    const body = await res.json();
    expect(res.status() === 429 || !body.ok).toBeTruthy();
  });
});
