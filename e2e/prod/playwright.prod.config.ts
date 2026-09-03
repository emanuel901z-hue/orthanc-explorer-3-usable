import { defineConfig } from '@playwright/test';

/**
 * Production test config — runs against deployed OE3 instance.
 *
 * Prerequisites:
 *   - OE3 Docker container running (docker compose up -d oe3)
 *   - Nginx proxying /oe3/ to the container
 *
 * Run: npx playwright test --config=e2e/prod/playwright.prod.config.ts
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/prod/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://10.0.1.46:3080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /prod-viewport\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'mobile',
      testMatch: /prod-viewport\.spec\.ts/,
      use: {
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
