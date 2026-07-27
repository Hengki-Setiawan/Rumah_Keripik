import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXTAUTH_URL ||
  'http://127.0.0.1:3000';

const authFile = 'e2e/.auth/admin.json';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: authFile },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: authFile },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: authFile },
    },
    {
      name: 'mobile-chrome',
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'], storageState: authFile },
    },
    {
      name: 'mobile-safari',
      dependencies: ['setup'],
      use: { ...devices['iPhone 12'], storageState: authFile },
    },
  ],
});
