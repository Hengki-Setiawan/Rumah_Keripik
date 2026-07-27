import { expect, type Page, type Locator } from '@playwright/test';

export class AdminPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoCodApproval() {
    await this.page.goto('/pembayaran/cod');
    await expect(this.page).toHaveURL(/\/pembayaran\/cod/);
  }

  async approveCodOrder(phone: string) {
    const normalized = phone.startsWith('0') ? `62${phone.slice(1)}` : phone;
    const card = this.page.locator('[data-testid^="cod-order-"]').filter({ hasText: normalized }).first();
    await expect(card).toBeVisible();

    this.page.once('dialog', (dialog) => dialog.accept());
    await card.locator('[data-testid^="cod-approve-"]').click();
    await expect(this.page.getByText(/COD disetujui/i)).toBeVisible();
  }

  async markOrderCompleted(orderCode: string) {
    await this.page.goto('/transaksi');
    await expect(this.page).toHaveURL(/\/transaksi/);

    const row = this.page.locator('tr').filter({ hasText: orderCode }).first();
    await expect(row).toBeVisible();

    this.page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Kirim' }).click();
    await expect(this.page.getByText(/status order dikirim/i)).toBeVisible();

    const updatedRow = this.page.locator('tr').filter({ hasText: orderCode }).first();
    this.page.once('dialog', (dialog) => dialog.accept());
    await updatedRow.getByRole('button', { name: 'Selesai' }).click();
    await expect(this.page.getByText(/status order selesai/i)).toBeVisible();
  }
}
