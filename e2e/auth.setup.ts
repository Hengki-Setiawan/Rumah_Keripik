import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';

const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const authFile = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  if (!adminUsername || !adminPassword) {
    await page.context().storageState({ path: authFile });
    return;
  }

  await page.goto('/login');
  await page.locator('#username').fill(adminUsername);
  await page.locator('#password').fill(adminPassword);
  await page.getByRole('button', { name: /masuk ke dashboard/i }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: authFile });
});
