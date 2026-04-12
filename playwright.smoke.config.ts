import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test configuration for OE3 v0.1 checklist.
 *
 * Prerequisites (handled by scripts/smoke.sh):
 *   1. Docker stack running: docker compose -f docker-compose.dev.yml up -d
 *   2. Sample data seeded: docker compose ... --profile seed up seeder
 *   3. Dev server running: npm run dev
 *
 * Run: npm run test:smoke
 */
export default defineConfig({
  testDir: './e2e/smoke',
  // Smoke tests are ordered (01-07) and share live state — run sequentially
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 45_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Suppress browser security prompts that block tests
    bypassCSP: true,
  },
  projects: [
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
