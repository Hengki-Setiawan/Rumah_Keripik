import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

// ============================================================================
// PROD cross-platform E2E — COD order → approve → ship → assign courier.
// NOT mocked. Drives the real /pesan chat UI, the real admin dashboard and
// verifies intermediate state against the prod Turso database.
// Run with: npx playwright test --config=playwright.prod.config.ts
// State (kode_pesanan / id_transaksi / courier_id) is persisted to
// e2e-run-state.json so the Maestro courier-app flow can pick it up.
// ============================================================================

const PROD = process.env.PLAYWRIGHT_BASE_URL || 'https://rumah-keripik.vercel.app';
const PRODUCT_ID = process.env.E2E_PRODUCT_ID || 'KRP-004';
const PRODUCT_NAME = process.env.E2E_PRODUCT_NAME || 'Kripik Mix Bumbu';
const QTY = Number(process.env.E2E_QTY || 2);
const UNIT_PRICE = Number(process.env.E2E_UNIT_PRICE || 20000);
const COURIER_PHONE = process.env.E2E_COURIER_PHONE || '08123456789';
const CUSTOMER_PHONE = process.env.E2E_CUSTOMER_PHONE || '081234567899';
const RECEIVER_NAME = process.env.E2E_RECEIVER_NAME || 'Ibu E2E';
const ADDRESS_TEXT =
  process.env.E2E_ADDRESS_TEXT ||
  'Jl. Gunung Agung No. 12, Kec. Rappocini, Kota Makassar, Sulawesi Selatan';
const ADDRESS_NOTE = process.env.E2E_ADDRESS_NOTE || 'Patokan toko kelontong';
const RUN_STATE_PATH = path.join(process.cwd(), 'e2e-run-state.json');

type RunState = {
  kode_pesanan: string;
  id_transaksi: string;
  total_bayar: number;
  courier_id: number;
  customer_phone: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  stock_before: number;
};

const runState: RunState = {
  kode_pesanan: '',
  id_transaksi: '',
  total_bayar: 0,
  courier_id: 0,
  customer_phone: CUSTOMER_PHONE,
  product_id: PRODUCT_ID,
  product_name: PRODUCT_NAME,
  qty: QTY,
  unit_price: UNIT_PRICE,
  stock_before: 0,
};

function saveRunState() {
  fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));
}

function loadRunState() {
  try {
    Object.assign(runState, JSON.parse(fs.readFileSync(RUN_STATE_PATH, 'utf8')));
  } catch {
    // no state file yet
  }
}

async function tursoRows(sql: string): Promise<Array<Record<string, unknown>>> {
  const dbUrl = (process.env.TURSO_DATABASE_URL || '')
    .replace(/^libsql:\/\//, 'https://')
    .replace(/\/$/, '');
  const token = process.env.TURSO_DATABASE_AUTH_TOKEN || '';
  if (!dbUrl || !token) throw new Error('TURSO_DATABASE_URL / TURSO_DATABASE_AUTH_TOKEN belum diset');
  const res = await fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  const step = json?.results?.[0];
  if (step?.response?.error) throw new Error(`Turso SQL error: ${JSON.stringify(step.response.error)}`);
  const result = step?.response?.result;
  if (!result) throw new Error(`Turso no result: ${JSON.stringify(json).slice(0, 500)}`);
  const cols: string[] = (result.cols || []).map((c: { name: string }) => c.name);
  return (result.rows || []).map((row: Array<{ type: string; value: unknown }>) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = row[i]?.value ?? null;
    });
    return obj;
  });
}

function rupiah(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

test.describe.serial('COD cross-platform E2E (prod, no mocks)', () => {
  test('customer creates COD order through the chat UI', async ({ page, context }) => {
    test.setTimeout(300_000);

    await context.grantPermissions(['geolocation'], { origin: PROD });
    await context.setGeolocation({ latitude: -5.14, longitude: 119.42 });

    const stockRows = await tursoRows(
      `SELECT stok_gudang_utama AS stock FROM produk WHERE id_produk = '${PRODUCT_ID}' LIMIT 1`,
    );
    runState.stock_before = Number(stockRows[0]?.stock ?? 0);
    expect(runState.stock_before).toBeGreaterThan(QTY);

    // --- open chat /pesan (idle state, deterministic products) ---
    await page.goto('/pesan');
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 90_000 });

    // --- add product (qty 1) via idle product card ---
    await page.getByTestId(`idle-product-${PRODUCT_ID}`).click();
    const cart = page.getByTestId('chat-cart-summary').first();
    await expect(cart).toBeVisible({ timeout: 40_000 });
    await expect(cart).toContainText(PRODUCT_NAME);

    // --- bump to qty 2 via the cart "+" button (minus=0, plus=1) ---
    await cart.locator('button').nth(1).click();
    await expect(cart).toContainText(rupiah(UNIT_PRICE * QTY), { timeout: 40_000 });

    // --- choose COD payment ---
    await page.getByTestId('cart-choose-payment').click();
    await expect(page.getByTestId('payment-method-PM-COD-PERMANENT')).toBeVisible({ timeout: 40_000 });
    await page.getByTestId('payment-method-PM-COD-PERMANENT').click();

    // --- customer step ---
    await expect(page.getByTestId('order-customer-name')).toBeVisible({ timeout: 40_000 });
    await page.getByTestId('order-customer-name').fill(RECEIVER_NAME);
    await page.getByTestId('order-customer-phone').fill(CUSTOMER_PHONE);
    await page.getByTestId('order-customer-pin').fill('4713');
    await page.getByTestId('order-step-address').click();

    // --- address step (must capture lat/lng for delivery assignment) ---
    await expect(page.getByTestId('order-address-text')).toBeVisible();
    await page.getByTestId('order-address-text').fill(ADDRESS_TEXT);
    await page.getByTestId('order-address-note').fill(ADDRESS_NOTE);
    await page.getByTestId('order-address-geolocate').click();
    await expect(page.getByText('Koordinat tersimpan')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('order-step-payment').click();

    // --- payment + notes + review ---
    await expect(page.getByTestId('order-notes')).toBeVisible();
    await page.getByTestId('order-notes').fill('[E2E] cross-platform COD run');
    await page.getByTestId('order-step-review').click();
    await expect(page.getByTestId('order-submit')).toBeVisible();

    // --- create order (capture statusUrl from API response) ---
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/chat/action') && r.request().method() === 'POST',
    );
    await page.getByTestId('order-submit').click();
    const resp = await respPromise;
    const body = (await resp.json()) as { ok: boolean; statusUrl: string };
    expect(body.ok).toBe(true);
    expect(body.statusUrl).toMatch(/^\/pesan\/sukses\//);
    runState.kode_pesanan = decodeURIComponent(body.statusUrl.split('/pesan/sukses/')[1].split('?')[0]);
    expect(runState.kode_pesanan.length).toBeGreaterThan(0);

    // --- navigate to success page via real quick reply ---
    await expect(page.getByTestId('chat-quick-lihat-status')).toBeVisible({ timeout: 40_000 });
    await page.getByTestId('chat-quick-lihat-status').click();
    await expect(page).toHaveURL(/\/pesan\/sukses\//, { timeout: 40_000 });
    await expect(page.getByTestId('success-order-code')).toBeVisible({ timeout: 40_000 });
    const kodeOnPage = (await page.getByTestId('success-order-code').innerText()).trim();
    expect(kodeOnPage).toBe(runState.kode_pesanan);

    // --- DB verify: order persisted correctly ---
    const order = await tursoRows(
      `SELECT id_transaksi, total_bayar, order_status, payment_status, status_pembayaran, lat_pengiriman, lng_pengiriman
       FROM transaksi WHERE kode_pesanan = '${runState.kode_pesanan}' LIMIT 1`,
    );
    expect(order.length).toBe(1);
    runState.id_transaksi = String(order[0].id_transaksi);
    runState.total_bayar = Number(order[0].total_bayar);
    expect(order[0].order_status).toBe('awaiting_admin_confirmation');
    expect(order[0].payment_status).toBe('cod_requested');
    expect(order[0].status_pembayaran).toBe('Menunggu_Verifikasi');
    expect(runState.total_bayar).toBe(UNIT_PRICE * QTY);
    expect(order[0].lat_pengiriman).not.toBeNull();
    expect(order[0].lng_pengiriman).not.toBeNull();

    const intent = await tursoRows(
      `SELECT status FROM payment_intent WHERE id_transaksi = '${runState.id_transaksi}' LIMIT 1`,
    );
    expect(intent[0]?.status).toBe('awaiting_admin_verification');

    saveRunState();
    test.info().annotations.push({
      type: 'order',
      description: `${runState.kode_pesanan} / ${runState.id_transaksi} / Rp ${rupiah(runState.total_bayar)}`,
    });
  });

  test('admin approves COD, ships the order and assigns the courier', async ({ page }) => {
    test.setTimeout(300_000);
    loadRunState();
    test.skip(!runState.id_transaksi, 'Tidak ada order — jalankan test customer dulu');
    test.skip(!runState.courier_id, 'courier_id kosong');

    page.on('dialog', (d) => d.accept());

    // --- admin login via real UI ---
    await page.goto('/login');
    await page.fill('#username', process.env.ADMIN_USERNAME || '');
    await page.fill('#password', process.env.ADMIN_PASSWORD || '');
    await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 });

    // --- approve COD ---
    await page.goto('/dashboard/pembayaran/cod');
    const approveBtn = page.getByTestId(`cod-approve-${runState.id_transaksi}`);
    await expect(approveBtn).toBeVisible({ timeout: 90_000 });
    await approveBtn.click();
    await expect(approveBtn).toBeDisabled({ timeout: 40_000 });

    const approved = await tursoRows(
      `SELECT order_status, payment_status, status_pembayaran FROM transaksi WHERE id_transaksi = '${runState.id_transaksi}'`,
    );
    expect(approved[0].payment_status).toBe('cod_approved');
    expect(approved[0].order_status).toBe('processing');
    expect(approved[0].status_pembayaran).toBe('Piutang');

    const stockAfter = await tursoRows(
      `SELECT stok_gudang_utama AS s FROM produk WHERE id_produk = '${runState.product_id}' LIMIT 1`,
    );
    expect(Number(stockAfter[0].s)).toBe(runState.stock_before - runState.qty);

    // --- ship (sets order_status=shipping → appears in deliveries/pending) ---
    await page.goto('/dashboard/transaksi');
    await expect(page.getByTestId(`tx-shipping-${runState.id_transaksi}`)).toBeVisible({ timeout: 90_000 });
    await page.getByTestId(`tx-shipping-${runState.id_transaksi}`).click();
    await expect
      .poll(async () => {
        const rows = await tursoRows(
          `SELECT order_status FROM transaksi WHERE id_transaksi = '${runState.id_transaksi}'`,
        );
        return rows[0]?.order_status;
      }, { timeout: 40_000 })
      .toBe('shipping');

    // --- resolve courier id (Budi) ---
    const couriers = await tursoRows(
      `SELECT id FROM couriers WHERE phone = '${COURIER_PHONE}' LIMIT 1`,
    );
    runState.courier_id = Number(couriers[0]?.id ?? 0);
    expect(runState.courier_id).toBeGreaterThan(0);
    saveRunState();

    // --- assign courier via UI ---
    await page.goto('/dashboard/kurir/assign');
    const search = page.getByPlaceholder('Cari pesanan...');
    await expect(search).toBeVisible({ timeout: 90_000 });
    await search.fill(runState.kode_pesanan);
    const card = page
      .locator('div.bg-white.rounded-lg.border.p-4')
      .filter({ hasText: runState.kode_pesanan })
      .first();
    await expect(card).toBeVisible({ timeout: 40_000 });
    await card.locator('select').selectOption(String(runState.courier_id));
    await card.getByRole('button', { name: 'Assign' }).click();

    await expect
      .poll(async () => {
        const rows = await tursoRows(
          `SELECT kurir_id, status FROM delivery_assignment WHERE id_transaksi = '${runState.id_transaksi}'`,
        );
        return rows.length ? `${rows[0].kurir_id}|${rows[0].status}` : '';
      }, { timeout: 40_000 })
      .toBe(`${runState.courier_id}|Siap_Dikirim`);

    test.info().annotations.push({
      type: 'assign',
      description: `courier ${runState.courier_id} / ${runState.kode_pesanan}`,
    });
  });
});
