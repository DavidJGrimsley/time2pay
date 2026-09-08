import { defineConfig, devices } from '@playwright/test';
import { createE2eEnvironment } from './scripts/e2e-env.mjs';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run serve:prod',
    url: 'http://127.0.0.1:4173/__time2pay_build.json',
    reuseExistingServer: !process.env.CI,
    env: createE2eEnvironment({ PORT: '4173' }),
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
