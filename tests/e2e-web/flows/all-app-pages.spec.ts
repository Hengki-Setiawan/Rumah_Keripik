import { test, expect } from '@playwright/test';
import { mockAllApi } from '../fixtures/mock-api';

test.describe('Complete Website Coverage Suite — Every Single App Page', () => {
  test.beforeEach(async ({ page }) => {
    mockAllApi(page);
  });

  // --- Document & Printable Pages ---
  test('P1: /dokumen/order/MOCK-001/receipt (Struk)', async ({ page }) => {
    await page.goto('/dokumen/order/MOCK-001/receipt');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P2: /dokumen/order/MOCK-001/proforma (Proforma Invoice)', async ({ page }) => {
    await page.goto('/dokumen/order/MOCK-001/proforma');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P3: /dokumen/order/MOCK-001/packing-label (Label Pengiriman)', async ({ page }) => {
    await page.goto('/dokumen/order/MOCK-001/packing-label');
    await expect(page.locator('body')).toBeVisible();
  });

  // --- Core Executive Dashboards ---
  test('P4: /dashboard (Main Admin Dashboard)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P5: /analitik (Analitik Penjualan)', async ({ page }) => {
    await page.goto('/analitik');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P6: /analitik/public-ordering (Analitik Pesanan Publik)', async ({ page }) => {
    await page.goto('/analitik/public-ordering');
    await expect(page.locator('body')).toBeVisible();
  });

  // --- Courier Management ---
  test('P7: /kurir (Daftar Kurir)', async ({ page }) => {
    await page.goto('/kurir');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P8: /kurir/live (Tracking Kurir Realtime)', async ({ page }) => {
    await page.goto('/kurir/live');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P9: /kurir/assign (Penugasan Kurir)', async ({ page }) => {
    await page.goto('/kurir/assign');
    await expect(page.locator('body')).toBeVisible();
  });

  // --- Payment Operations ---
  test('P10: /pembayaran/metode (Metode Pembayaran)', async ({ page }) => {
    await page.goto('/pembayaran/metode');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P11: /pembayaran/verifikasi (Verifikasi Transfer)', async ({ page }) => {
    await page.goto('/pembayaran/verifikasi');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P12: /pembayaran/cod (Manajemen COD)', async ({ page }) => {
    await page.goto('/pembayaran/cod');
    await expect(page.locator('body')).toBeVisible();
  });

  // --- Master Data Sub-Pages ---
  test('P13: /master-data/kategori-produk (Kategori Produk)', async ({ page }) => {
    await page.goto('/master-data/kategori-produk');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P14: /master-data/varian-produk (Varian Rasa & Ukuran)', async ({ page }) => {
    await page.goto('/master-data/varian-produk');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P15: /master-data/pelanggan (Daftar Pelanggan)', async ({ page }) => {
    await page.goto('/master-data/pelanggan');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P16: /master-data/zona-pengiriman (Zona Kirim & Ongkir)', async ({ page }) => {
    await page.goto('/master-data/zona-pengiriman');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P17: /master-data/warung (Kemitraan Warung)', async ({ page }) => {
    await page.goto('/master-data/warung');
    await expect(page.locator('body')).toBeVisible();
  });

  // --- AI Operations & Monitoring Dashboards ---
  test('P18: /ai-ops (AI System Operations)', async ({ page }) => {
    await page.goto('/ai-ops');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P19: /ai-monitor (Realtime AI Monitor)', async ({ page }) => {
    await page.goto('/ai-monitor');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P20: /knowledge-base (RAG Knowledge Base)', async ({ page }) => {
    await page.goto('/knowledge-base');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P21: /bot-config (Konfigurasi Bot Prompt)', async ({ page }) => {
    await page.goto('/bot-config');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P22: /slo-dashboard (Dashboard SLA / SLO)', async ({ page }) => {
    await page.goto('/slo-dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P23: /sos (Emergency Admin Switch)', async ({ page }) => {
    await page.goto('/sos');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P24: /model-router (Multi-LLM Router Config)', async ({ page }) => {
    await page.goto('/model-router');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P25: /web-sessions (Sesi Chat Customer Web)', async ({ page }) => {
    await page.goto('/web-sessions');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P26: /livechat (Live Chat Agent Handoff)', async ({ page }) => {
    await page.goto('/livechat');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P27: /admin-guide (Panduan Penggunaan Admin)', async ({ page }) => {
    await page.goto('/admin-guide');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P28: /audit-ai (Log Audit AI & System)', async ({ page }) => {
    await page.goto('/audit-ai');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P29: /failed-conversations (Analisis Chat Gagal)', async ({ page }) => {
    await page.goto('/failed-conversations');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P30: /feedback-learning (Feedback Loop Learning)', async ({ page }) => {
    await page.goto('/feedback-learning');
    await expect(page.locator('body')).toBeVisible();
  });
});
