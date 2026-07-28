import type { Page, Route } from '@playwright/test';

const adminSession = {
  user: { id: '1', name: 'Admin Rumah Kripik', email: 'admin@rumahkripik.local' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

export async function mockAdminSession(page: Page) {
  page.route('**/api/auth/session', async (route: Route, request) => {
    if (request.method() === 'GET') {
      if (request.url().includes('api/auth/session')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminSession) });
        return;
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminSession) });
  });

  page.route('**/api/auth/csrf', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: 'mock-csrf-token' }) });
  });

  page.route('**/api/auth/callback/credentials', async (route: Route) => {
    const postData = JSON.parse(route.request().postData() || '{}');
    const valid = postData.username === 'admin' && postData.password === 'admin123';
    if (valid) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: '/dashboard' }) });
    } else {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    }
  });

  page.route('**/api/auth/signout', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

export async function mockAdminDashboardApi(page: Page) {
  page.route('**/api/admin/notification-counts', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pending_verifikasi: 3, unread_chats: 5, active_sos: 0 }) });
  });

  page.route('**/api/analytics/kpi', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pendapatan_hari_ini: 1250000, pendapatan_kemarin: 980000, order_hari_ini: 12, order_kemarin: 8, chat_bot_hari_ini: 45, pending_verifikasi: 3 }) });
  });

  page.route('**/api/worker/status', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ online: true, counts: { pending: 0, processing: 2, failed: 0 }, workers: [{ worker_id: 'w1', worker_name: 'AI Worker 1', seconds_ago: 5, online: true }] }) });
  });

  page.route('**/api/analytics/public-order-operations', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: { orders30d: 120, chatOrders30d: 85 }, recentChatOrders: [] }) });
  });
}
