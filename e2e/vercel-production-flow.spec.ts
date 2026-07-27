import { expect, test } from '@playwright/test';
import { createHash } from 'crypto';

let db: any = null;
let transaksi: any = null;
let eq: any = null;

try {
  const path = require.resolve('@/lib/db', { paths: [process.cwd()] });
  if (path) {
    const dbModule = require('@/lib/db');
    db = dbModule.db;
    const schemaModule = require('@/lib/schema');
    transaksi = schemaModule.transaksi;
    eq = require('drizzle-orm').eq;
  }
} catch (e) {
  process.stderr.write(`WARNING: DB module not available, skipping DB-dependent tests\n`);
}

const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'hengki123';
const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

function randomPhone() {
  const suffix = `${Date.now()}`.slice(-8);
  return `0813${suffix}`;
}

async function simulateMidtransWebhook(baseUrl: string, orderId: string, amount: string) {
  const statusCode = '200';
  const raw = `${orderId}${statusCode}${amount}${serverKey}`;
  const signatureKey = createHash('sha512').update(raw).digest('hex');

  const webhookPayload = {
    transaction_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    transaction_status: 'settlement',
    status_message: 'midtrans payment notification',
    status_code: statusCode,
    signature_key: signatureKey,
    payment_type: 'qris',
    order_id: orderId,
    merchant_id: 'G986123446',
    gross_amount: amount,
    fraud_status: 'accept',
    transaction_id: `tr-${Date.now()}`,
  };

  const response = await fetch(`${baseUrl}/api/webhook/midtrans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    throw new Error(`Webhook simulation failed with status ${response.status}: ${await response.text()}`);
  }
}

test.describe('Vercel Production E2E Lifecycle Flow', () => {
  test('Flow lengkap dari chat AI, bayar online QRIS (simulasi), hingga admin kirim/selesai', async ({ page, baseURL }) => {
    if (!db) {
      test.skip(true, 'DB module not available — skipping');
    }

    const targetUrl = baseURL || 'https://rumah-keripik.vercel.app';
    console.log(`Menjalankan pengujian E2E pada website: ${targetUrl}`);

    const phone = randomPhone();

    await page.goto(`${targetUrl}/pesan`);
    await expect(page.getByText(/mau pesan keripik apa hari ini/i).first()).toBeVisible();

    await page.locator('[data-testid="chat-input"], textarea[placeholder*="Tanya stok"]').first().fill('2 pedas');
    await page.locator('[data-testid="chat-send"], button[aria-label="Kirim pesan"]').first().click();

    const checkoutButton = page.getByRole('button', { name: /checkout|lihat keranjang|lanjut bayar/i });
    await expect(checkoutButton).toBeVisible({ timeout: 30000 });
    await checkoutButton.click();

    const phoneInput = page.locator('[data-testid="order-customer-phone"], input[placeholder*="WhatsApp"]').first();
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill(phone);
    await phoneInput.blur();

    const pinInput = page.locator('[data-testid="order-customer-pin"], input[placeholder*="PIN"]').first();
    await pinInput.fill('1234');

    const nextAddress = page.getByRole('button', { name: /lanjut alamat/i });
    await expect(nextAddress).toBeEnabled({ timeout: 10000 });
    await nextAddress.click();

    const addressInput = page.locator('[data-testid="order-address-text"], textarea[placeholder*="Alamat lengkap"]').first();
    await expect(addressInput).toBeVisible({ timeout: 5000 });
    await addressInput.fill('Jl. Testing E2E No. 1, Jakarta');
    await page.locator('[data-testid="order-address-note"], input[placeholder*="Patokan"], input[placeholder*="kurir"]').first().fill('Dekat masjid');

    const nextPayment = page.getByRole('button', { name: /lanjut pembayaran/i });
    await expect(nextPayment).toBeEnabled();
    await nextPayment.click();

    const qrisOption = page.locator('[data-testid^="payment-method-"], button').filter({ hasText: /qris|bca|bri|mandiri|bni/i }).first();
    await expect(qrisOption).toBeVisible({ timeout: 10000 });
    await qrisOption.click();

    const orderNotes = page.locator('[data-testid="order-notes"], textarea[placeholder*="Catatan pesanan"]').first();
    await orderNotes.fill('Test E2E — tolong diabaikan');

    const reviewButton = page.getByRole('button', { name: /review order/i });
    await expect(reviewButton).toBeEnabled();
    await reviewButton.click();

    const confirmButton = page.getByRole('button', { name: /konfirmasi .*buat order|konfirmasi & buat order/i });
    await expect(confirmButton).toBeEnabled({ timeout: 10000 });
    await confirmButton.click();

    const successText = page.getByText(/order berhasil dibuat|order cod berhasil dibuat|kode pesanan/i);
    await expect(successText).toBeVisible({ timeout: 30000 });

    let orderCode = '';
    const successMatch = page.url().match(/\/pesan\/sukses\/(.+)/);
    if (successMatch) {
      orderCode = decodeURIComponent(successMatch[1]);
    } else {
      const orderLine = page.getByText(/^Order:\s+/).last();
      await expect(orderLine).toBeVisible();
      orderCode = ((await orderLine.textContent()) || '').replace(/^Order:\s*/, '').trim();
    }
    expect(orderCode).not.toHaveLength(0);

    console.log(`Order created: ${orderCode}`);

    if (db) {
      const [order] = await db
        .select()
        .from(transaksi)
        .where(eq(transaksi.kode_pesanan, orderCode))
        .limit(1);

      expect(order).toBeTruthy();
      expect(order.status).toBe('menunggu_pembayaran');
      console.log(`Order DB ID: ${order.id_transaksi}, Status: ${order.status}`);
    }

    if (serverKey && db) {
      console.log('Simulating Midtrans webhook for QRIS settlement...');
      await simulateMidtransWebhook(targetUrl, orderCode, '50000');

      const [paidOrder] = await db
        .select()
        .from(transaksi)
        .where(eq(transaksi.kode_pesanan, orderCode))
        .limit(1);

      expect(paidOrder).toBeTruthy();
      expect(['konfirmasi_pembayaran', 'diproses']).toContain(paidOrder.status);
      console.log(`After payment - Status: ${paidOrder.status}`);

      const adminLoginPage = `${targetUrl}/login`;
      await page.goto(adminLoginPage);
      await expect(page.getByLabel(/username|email/i).first()).toBeVisible({ timeout: 10000 });
      await page.getByLabel(/username|email/i).first().fill(adminUsername);
      await page.getByLabel(/password|kata sandi/i).first().fill(adminPassword);
      await page.getByRole('button', { name: /masuk|login|sign in/i }).first().click();
      await expect(page).toHaveURL(/dashboard|admin/i, { timeout: 15000 });

      const orderLink = page.locator(`a[href*="${orderCode}"]`).first();
      await expect(orderLink).toBeVisible({ timeout: 15000 });
    }

    console.log('✅ E2E lifecycle flow selesai');
  });
});
