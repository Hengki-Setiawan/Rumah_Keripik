import { expect, test, type Page } from '@playwright/test';

const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

function randomPhone() {
  const suffix = `${Date.now()}`.slice(-8);
  return `0813${suffix}`;
}

function normalizePhone(phone: string) {
  return phone.startsWith('0') ? `62${phone.slice(1)}` : phone;
}

async function fillChatOrderForm(page: Page, {
  name,
  phone,
  address,
  note,
}: {
  name: string;
  phone: string;
  address: string;
  note: string;
}) {
  await page.locator('[data-testid="order-customer-name"], input[placeholder*="Nama penerima"]').first().fill(name);
  await page.locator('[data-testid="order-customer-phone"], input[placeholder*="WhatsApp"]').first().fill(phone);
  await page.locator('[data-testid="order-customer-phone"], input[placeholder*="WhatsApp"]').first().blur();
  const addressStepButton = page.getByRole('button', { name: /lanjut alamat/i });
  await expect(addressStepButton).toBeEnabled({ timeout: 10000 });
  await addressStepButton.click();
  await page.locator('[data-testid="order-address-text"], textarea[placeholder*="Alamat lengkap"]').first().fill(address);
  await page.locator('[data-testid="order-address-note"], input[placeholder*="Patokan"], input[placeholder*="kurir"]').first().fill('Dekat masjid besar');
  await page.getByRole('button', { name: /lanjut pembayaran/i }).click();
  await pickCodPayment(page);
  await page.locator('[data-testid="order-notes"], textarea[placeholder*="Catatan pesanan"]').first().fill(note);
  await page.getByRole('button', { name: /review order/i }).click();
  await page.getByRole('button', { name: /konfirmasi .*buat order|konfirmasi & buat order/i }).click();
}

async function pickCodPayment(page: Page) {
  const codButton = page.locator('[data-testid^="payment-method-"], button').filter({ hasText: /cod|bayar di tempat/i }).first();
  await expect(codButton).toBeVisible();
  await codButton.click();
}

async function readSuccessPayload(page: Page) {
  if (/\/pesan\/sukses\//.test(page.url())) {
    const successUrl = new URL(page.url());
    const orderCode = decodeURIComponent(successUrl.pathname.split('/').pop() || '');
    expect(orderCode).not.toHaveLength(0);

    const statusHref = await page.getByRole('link', { name: /lihat status pesanan/i }).getAttribute('href');
    expect(statusHref).toBeTruthy();
    return { orderCode, transactionId: null, statusHref: statusHref! };
  }

  await expect(page.getByText(/order cod berhasil dibuat|status pesanan/i).first()).toBeVisible();
  const orderLine = page.getByText(/^Order:\s+/).last();
  await expect(orderLine).toBeVisible();
  const orderText = (await orderLine.textContent()) || '';
  const transactionId = orderText.replace(/^Order:\s*/, '').trim();
  expect(transactionId).not.toHaveLength(0);

  const viewStatusButton = page.getByRole('button', { name: /lihat status/i }).last();
  await expect(viewStatusButton).toBeVisible();
  await viewStatusButton.click();
  await expect(page).toHaveURL(/\/pesan\/(sukses|status)\//);

  if (/\/pesan\/status\//.test(page.url())) {
    return { orderCode: transactionId, transactionId, statusHref: page.url() };
  }

  const successUrl = new URL(page.url());
  const orderCode = decodeURIComponent(successUrl.pathname.split('/').pop() || '');
  expect(orderCode).not.toHaveLength(0);
  const statusHref = await page.getByRole('link', { name: /lihat status pesanan/i }).getAttribute('href');
  expect(statusHref).toBeTruthy();
  return { orderCode, transactionId, statusHref: statusHref! };
}

async function loginAdmin(page: Page, callbackUrl: string) {
  test.skip(!adminUsername || !adminPassword, 'ADMIN_USERNAME / ADMIN_PASSWORD belum tersedia di env untuk test admin flow.');

  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.locator('#username').fill(adminUsername!);
  await page.locator('#password').fill(adminPassword!);
  await page.getByRole('button', { name: /masuk ke dashboard/i }).click();
}

async function approveCodOrder(page: Page, phone: string) {
  await loginAdmin(page, '/pembayaran/cod');
  await expect(page).toHaveURL(/\/pembayaran\/cod/);

  const card = page.locator('[data-testid^="cod-order-"]').filter({ hasText: normalizePhone(phone) }).first();
  await expect(card).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await card.locator('[data-testid^="cod-approve-"]').click();
  await expect(page.getByText(/COD disetujui/i)).toBeVisible();
}

async function markOrderCompleted(page: Page, orderCode: string) {
  await page.goto('/transaksi');
  await expect(page).toHaveURL(/\/transaksi/);

  const row = page.locator('tr').filter({ hasText: orderCode }).first();
  await expect(row).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Kirim' }).click();
  await expect(page.getByText(/status order dikirim/i)).toBeVisible();

  const updatedRow = page.locator('tr').filter({ hasText: orderCode }).first();
  page.once('dialog', (dialog) => dialog.accept());
  await updatedRow.getByRole('button', { name: 'Selesai' }).click();
  await expect(page.getByText(/status order selesai/i)).toBeVisible();
}

async function verifyPublicCompleted(page: Page, statusHref: string) {
  await page.goto(statusHref);
  await expect(page.getByText('Status pesanan', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Order$/)).toBeVisible();
  await expect(page.getByText(/^completed$/)).toBeVisible();
}

test.describe('/pesan end-to-end', () => {
  test('manual chat bisa memproses intent kompleks sampai order selesai', async ({ page }) => {
    const phone = randomPhone();

    await page.goto('/pesan');
    await expect(page.getByText(/mau pesan keripik apa hari ini/i)).toBeVisible();

    await page.locator('[data-testid="chat-input"], textarea[placeholder*="Tanya stok"]').first().fill('2 pedas + COD + untuk acara kantor malam ini');
    await page.getByRole('button', { name: /kirim pesan/i }).click();

    await expect(page.getByText(/buat order dari chat|ringkasan keranjang|pilih metode pembayaran/i).first()).toBeVisible();
    await fillChatOrderForm(page, {
      name: 'Tester Manual',
      phone,
      address: 'Jl. Ahmad Yani No. 12, Samarinda',
      note: 'Untuk acara kantor, tolong aman packing',
    });

    const { orderCode, statusHref } = await readSuccessPayload(page);

    await approveCodOrder(page, phone);
    await markOrderCompleted(page, orderCode);
    await verifyPublicCompleted(page, statusHref);
  });

  test('flow tombol starter prompt tetap bisa checkout sampai selesai', async ({ page }) => {
    const phone = randomPhone();

    await page.goto('/pesan');
    await expect(page.getByText(/mau pesan keripik apa hari ini/i)).toBeVisible();

    await page.getByRole('button', { name: /lihat produk/i }).click();
    const firstAddButton = page.locator('[data-testid^="add-to-cart-"]').first();
    await expect(firstAddButton).toBeVisible();
    await firstAddButton.click();

    await expect(page.getByText(/ringkasan keranjang|buat order dari chat|pilih metode pembayaran/i).first()).toBeVisible();
    const choosePayment = page.locator('[data-testid="cart-choose-payment"], button').filter({ hasText: /pilih pembayaran|cara bayar/i }).first();
    if (await choosePayment.count()) {
      await choosePayment.click();
    }
    await pickCodPayment(page);

    await fillChatOrderForm(page, {
      name: 'Tester Tombol',
      phone,
      address: 'Jl. Pahlawan No. 7, Samarinda',
      note: 'Flow via tombol starter prompt',
    });

    const { orderCode, statusHref } = await readSuccessPayload(page);

    await approveCodOrder(page, phone);
    await markOrderCompleted(page, orderCode);
    await verifyPublicCompleted(page, statusHref);
  });
});
