/**
 * Smoke items 5–6: Study list and study detail.
 *
 * Checklist:
 *   [5] Study list shows ≥1 seeded study; search fires POST /tools/find
 *   [6] Clicking a study opens detail; series load from /studies/{id}/series
 */
import { test, expect } from '@playwright/test';

test.describe('Studies', () => {
  test('item 5: study list shows real data and fires POST /tools/find', async ({ page }) => {
    // Capture the tools/find request before navigating
    const findRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/tools/find') && req.method() === 'POST',
    );

    await page.goto('/studies');
    await findRequest;

    // Wait for skeleton loaders to resolve into real rows
    await page.waitForSelector('[data-testid="study-row"]', { timeout: 15_000 });

    const rows = page.locator('[data-testid="study-row"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(1);

    // Verify no serialization artifacts
    const tableText = await page.locator('table').innerText();
    expect(tableText).not.toContain('[object Object]');
    expect(tableText).not.toContain('undefined');
  });

  test('item 6: study detail loads series from /studies/{id}/series', async ({ page }) => {
    await page.goto('/studies');
    await page.waitForSelector('[data-testid="study-row"]');

    // Intercept the series request that fires when detail page mounts
    const seriesRequest = page.waitForRequest(
      (req) => /\/studies\/[^/]+\/series/.test(req.url()),
      { timeout: 15_000 },
    );

    await page.locator('[data-testid="study-row"]').first().click();
    await seriesRequest;

    // URL must have changed to /studies/<id>
    await expect(page).toHaveURL(/\/studies\/.+/);

    // Page content must not contain serialization artifacts
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('[object Object]');
    expect(body).not.toContain('undefined');
  });
});
