/**
 * Smoke items 3–4: App boot and runtime config.
 *
 * Checklist:
 *   [3] Browser loads http://localhost:5173 without red console errors
 *   [4] window.__OE3_CONFIG__ is populated and validates cleanly
 */
import { test, expect } from '@playwright/test';

test.describe('App boot', () => {
  test('item 3: loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known benign browser noise
    const real = errors.filter(
      (e) =>
        !e.includes('React DevTools') &&
        !e.includes('Download the React') &&
        !e.includes('favicon'),
    );
    expect(real, `Console errors:\n${real.join('\n')}`).toHaveLength(0);
  });

  test('item 4: runtime config is populated', async ({ page }) => {
    await page.goto('/');

    const config = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__OE3_CONFIG__,
    );

    expect(config, 'window.__OE3_CONFIG__ must exist').toBeTruthy();
    expect(config).toHaveProperty('orthancUrl');
    expect(config).toHaveProperty('authMode');
    expect(config).toHaveProperty('features');

    // No Zod validation errors means loadConfig() succeeded — the app
    // would have shown an error screen instead of the study list.
    await expect(page.locator('h1, [role="main"]').first()).toBeVisible();
  });
});
