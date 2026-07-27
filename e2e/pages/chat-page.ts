import { expect, type Page, type Locator } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly greeting: Locator;

  constructor(page: Page) {
    this.page = page;
    this.input = page.locator('[data-testid="chat-input"], textarea[placeholder*="Tanya stok"]').first();
    this.sendButton = page.getByRole('button', { name: /kirim pesan/i });
    this.greeting = page.getByText(/mau pesan keripik apa hari ini/i);
  }

  async goto() {
    await this.page.goto('/pesan');
    await expect(this.greeting).toBeVisible();
  }

  async sendMessage(message: string) {
    await this.input.fill(message);
    await this.sendButton.click();
  }
}
