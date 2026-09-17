import { defineConfig } from '@playwright/test';

/**
 * Workspace-stack E2E config — runs against the dockerized deployment.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
 *   (workspace root; OE3 published on OE3_PORT, default 18082)
 *
 * Run:  npx playwright test --config=e2e/stack/playwright.stack.config.ts
 *
 * No login needed — the stack's oe3-config.js sets authCheck:false
 * (standalone mode without backend proxy).
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/stack/report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.OE3_BASE ?? 'http://127.0.0.1:18082',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /(stack-viewport|broker-config)\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'mobile',
      testMatch: /(stack-viewport|broker-config)\.spec\.ts/,
      use: {
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
