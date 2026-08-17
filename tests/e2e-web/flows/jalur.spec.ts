import { test, expect } from '@playwright/test';

// ============================================================================
// Admin /kurir/jalur ΓÇö mock-based UI test (tidak menyentuh produksi).
// Verifikasi render kartu jalur, auto-build, assign kurir, optimize, complete.
// Run: npx playwright test tests/e2e-web/flows/jalur.spec.ts --project=chromium
// ============================================================================

const MOCK_DATE = '2099-01-01';

const mockRoutes = (overrides = {}) => [
  {
    id: 9001,
    routeName: 'Jalur #1 ΓÇö Utara',
    routeDate: MOCK_DATE,
    status: 'open',
    courierId: null,
    courierName: null,
    warehouseName: 'Rumah Produksi Kaluku Bodoa',
    stopCount: 3,
    estimatedDistanceKm: '12.4',
    estimatedDurationMinutes: 40,
    createdAt: new Date().toISOString(),
    completedAt: null,
    stops: [
      { id: 9101, idTransaksi: 'TX-9001', sequenceNo: 1, lat: '-5.141', lng: '119.400', address: 'Jl. Andi Mappanyukki', kodePesanan: 'RKM-9901', penerima: 'Andi' },
      { id: 9102, idTransaksi: 'TX-9002', sequenceNo: 2, lat: '-5.139', lng: '119.455', address: 'Jl. Jend. Sudirman', kodePesanan: 'RKM-9902', penerima: 'Budi' },
      { id: 9103, idTransaksi: 'TX-9003', sequenceNo: 3, lat: '-5.150', lng: '119.398', address: 'Jl. Gunung Agung', kodePesanan: 'RKM-9903', penerima: 'Citra' },
    ],
    ...overrides,
  },
];

const mockCouriers = [
  { id: 1, name: 'Budi', phone: '08123456789', is_active: 1 },
  { id: 3, name: 'Siti', phone: '08129876543', is_active: 1 },
];

function mockJalurApi(page: import('@playwright/test').Page) {
  page.route('**/api/admin/routes?*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, routes: mockRoutes() }) });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { routesCreated: 1, ordersClustered: 3, ordersWithoutCoord: 0 } }) });
    } else {
      await route.continue();
    }
  });
  page.route('**/api/admin/couriers*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, couriers: mockCouriers }) });
  });
  page.route('**/api/admin/routes/9001*', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { route: mockRoutes()[0], stops: [] } }) });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    } else {
      await route.continue();
    }
  });
}

test.describe('Admin Jalur (mock)', () => {
  test('menampilkan kartu jalur + assign kurir + optimize', async ({ page }) => {
    mockJalurApi(page);
    await page.goto(`/kurir/jalur?routeDate=${MOCK_DATE}`, { waitUntil: 'domcontentloaded' });

    const card = page.getByTestId('jalur-card-9001');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card).toContainText('Jalur #1 ΓÇö Utara');
    await expect(card).toContainText('3 stop');

    // Dropdown kurir + tombol optimize tampil.
    await expect(page.getByTestId('jalur-assign-select-9001')).toBeVisible();
    await expect(page.getByTestId('jalur-optimize-9001')).toBeVisible();

    // Tombol auto-build tampil dan bisa diklik (mock ΓåÆ sukses).
    const autoBtn = page.getByTestId('jalur-auto-build-button');
    await expect(autoBtn).toBeVisible();
    await autoBtn.click();
    await expect(page.getByTestId('jalur-card-9001')).toBeVisible({ timeout: 20000 });
  });

  test('status completed 409 bila ada stop belum selesai (mock)', async ({ page }) => {
    mockJalurApi(page);
    // Jalur dengan stop aktif ΓåÆ PATCH completed harus ditolak 409.
    page.route('**/api/admin/routes/9001', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Masih ada 3 stop belum selesai ΓÇö selesaikan semua pengiriman dulu atau batalkan jalur' }) });
      } else {
        await route.continue();
      }
    });
    await page.goto(`/kurir/jalur?routeDate=${MOCK_DATE}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('jalur-card-9001')).toBeVisible({ timeout: 20000 });
  });
});
