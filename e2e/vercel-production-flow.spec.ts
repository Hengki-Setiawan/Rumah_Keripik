import { expect, test } from '@playwright/test';
import { createHash } from 'crypto';

const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'hengki123';
const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

function randomPhone() {
  const suffix = `${Date.now()}`.slice(-8);
  return `0813${suffix}`;
}

async function simulateMidtransWebhook(baseUrl: string, orderId: string, amount: string) {
  // Generate signature key: order_id + status_code + gross_amount + ServerKey
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

  const response = await fetch(`${baseUrl}/api/payment/webhook/midtrans`, {
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
    const targetUrl = baseURL || 'https://rumah-keripik.vercel.app';
    console.log(`Menjalankan pengujian E2E pada website: ${targetUrl}`);

    const phone = randomPhone();

    // 1. Kunjungi halaman pesan
    await page.goto(`${targetUrl}/pesan`);
    await expect(page.getByText(/mau pesan keripik apa hari ini/i).first()).toBeVisible();

    // 2. Chatting dengan AI
    console.log('Mengirim pesan ke AI chatbot...');
    await page.locator('[data-testid="chat-input"], textarea[placeholder*="Tanya stok"]').first().fill('Saya mau pesan 1 keripik pedas dan mau bayar online');
    await page.getByRole('button', { name: /kirim pesan/i }).click();

    // Pastikan AI membalas dengan ringkasan keranjang
    console.log('Menunggu balasan AI chatbot...');
    await expect(page.getByText(/buat order dari chat|ringkasan keranjang|pilih metode pembayaran/i).first()).toBeVisible();

    // Perhatikan balasan AI
    const aiText = await page.locator('.prose, p').filter({ hasText: /pedas|keripik|alamat|siapkan/i }).first().textContent();
    console.log('Balasan AI Chatbot:', aiText);

    // 3. Isi formulir pemesanan
    console.log('Mengisi data penerima...');
    await page.locator('[data-testid="order-customer-name"], input[placeholder*="Nama penerima"]').first().fill('Tester E2E Vercel');
    await page.locator('[data-testid="order-customer-phone"], input[placeholder*="WhatsApp"]').first().fill(phone);
    await page.getByRole('button', { name: /lanjut alamat/i }).click();

    console.log('Mengisi alamat pengiriman...');
    await page.locator('[data-testid="order-address-text"], textarea[placeholder*="Alamat lengkap"]').first().fill('Jl. Sukses Vercel No. 9, Jakarta');
    await page.locator('[data-testid="order-address-note"], input[placeholder*="Patokan"], input[placeholder*="kurir"]').first().fill('Dekat server cloud');
    await page.getByRole('button', { name: /lanjut pembayaran/i }).click();

    // 4. Pilih pembayaran online (QRIS)
    console.log('Memilih metode pembayaran online...');
    const onlineButton = page.locator('[data-testid^="payment-method-"], button').filter({ hasText: /bayar online/i }).first();
    await expect(onlineButton).toBeVisible();
    await onlineButton.click();

    // 5. Review dan konfirmasi pesanan
    console.log('Meninjau pesanan...');
    await page.locator('[data-testid="order-notes"], textarea[placeholder*="Catatan pesanan"]').first().fill('E2E Production Live Test');
    await page.getByRole('button', { name: /review order/i }).click();
    await page.getByRole('button', { name: /konfirmasi .*buat order|konfirmasi & buat order/i }).click();

    // 6. Verifikasi pesanan berhasil dibuat dan QRIS muncul
    console.log('Menunggu verifikasi order dan rendering QRIS...');
    await expect(page.getByText(/order berhasil dibuat/i).first()).toBeVisible();

    // Ambil kode pesanan (misal TX-xxxx)
    const orderLine = page.getByText(/Order:\s+TX-\d+/i).first();
    const orderText = (await orderLine.textContent()) || '';
    const orderCode = orderText.match(/TX-\d+-\d+/)?.[0] || orderText.replace(/^Order:\s*/, '').trim();
    console.log(`Pesanan berhasil dibuat dengan Kode: ${orderCode}`);

    // Pastikan QRIS tampil
    const qrisImage = page.locator('img[alt="QRIS Midtrans"]');
    await expect(qrisImage).toBeVisible();
    console.log('Gambar QRIS Midtrans sukses ditampilkan langsung di chat!');

    // 7. Simulasikan Webhook Midtrans (Settlement Lunas) ke Vercel
    console.log(`Mengirimkan simulasi webhook pembayaran lunas untuk ${orderCode}...`);
    await simulateMidtransWebhook(targetUrl, orderCode, '18000.00');

    // 8. Buka tab baru atau kunjungi halaman admin untuk memproses pesanan
    console.log('Melakukan login admin...');
    await page.goto(`${targetUrl}/login`);
    await page.locator('#username').fill(adminUsername);
    await page.locator('#password').fill(adminPassword);
    await page.getByRole('button', { name: /masuk ke dashboard/i }).click();

    // Masuk ke dashboard transaksi
    console.log('Membuka daftar transaksi admin...');
    await page.goto(`${targetUrl}/transaksi`);
    await expect(page).toHaveURL(/\/transaksi/);

    // Cari transaksi berdasarkan kode pesanan
    const row = page.locator('tr').filter({ hasText: orderCode }).first();
    await expect(row).toBeVisible();
    console.log('Transaksi berhasil ditemukan di daftar dashboard admin!');

    // Pastikan status pembayaran sudah TERVERIFIKASI (karena webhook simulasi tadi)
    await expect(row.getByText(/verified|lunas|sudah bayar/i).first()).toBeVisible();
    console.log('Status pembayaran transaksi terverifikasi LUNAS secara otomatis oleh webhook!');

    // Ubah status ke Kirim (Shipped)
    console.log('Memproses order: Mengirim...');
    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: /kirim/i }).click();
    await expect(page.getByText(/status order dikirim/i).first()).toBeVisible();

    // Ubah status ke Selesai (Completed)
    console.log('Memproses order: Menyelesaikan...');
    const updatedRow = page.locator('tr').filter({ hasText: orderCode }).first();
    page.once('dialog', (dialog) => dialog.accept());
    await updatedRow.getByRole('button', { name: /selesai/i }).click();
    await expect(page.getByText(/status order selesai/i).first()).toBeVisible();
    console.log('Order berhasil diselesaikan oleh admin!');

    // 9. Verifikasi status publik di tracking page
    const trackingUrl = `${targetUrl}/pesan/status/${orderCode}`;
    console.log(`Memverifikasi halaman status pesanan publik: ${trackingUrl}`);
    await page.goto(trackingUrl);
    await expect(page.getByText(/Status pesanan/i).first()).toBeVisible();
    
    // Status akhir harus "completed" atau "selesai"
    await expect(page.getByText(/completed|selesai/i).first()).toBeVisible();
    console.log('Halaman status pesanan publik sukses menampilkan status completed!');
  });
});
