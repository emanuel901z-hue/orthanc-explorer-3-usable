/**
 * Smoke item 8: Activity timeline — live polling.
 *
 * Checklist:
 *   [8] Navigate to Activity; network shows periodic GET /changes?limit=100
 *       (refetchInterval is 5 s in useChanges)
 *
 * Uses page.route() instead of waitForRequest().
 * page.route() is registered atomically before page.goto(), so it cannot
 * miss requests that fire during page load — unlike waitForRequest() which
 * has a subtle race window when the Promise is created after goto resolves.
 */
import { test, expect } from '@playwright/test';

// Matches /orthanc-proxy/changes and /orthanc-proxy/changes?limit=100 etc.
const CHANGES_PATTERN = '**/orthanc-proxy/changes**';

test.describe('Activity timeline', () => {
  test('item 8: activity page makes GET /changes requests', async ({ page }) => {
    let capturedUrl: string | undefined;

    // page.route() is synchronous registration — no race with page.goto()
    await page.route(CHANGES_PATTERN, async (route) => {
      if (!capturedUrl && route.request().method() === 'GET') {
        capturedUrl = route.request().url();
      }
      await route.continue();
    });

    await page.goto('/activity');

    // Poll until the route handler fires (up to 15 s)
    await expect.poll(() => capturedUrl, { timeout: 15_000 }).toBeDefined();

    expect(capturedUrl).toContain('/changes');
    expect(capturedUrl).toContain('limit=');

    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('item 8b: a second /changes request fires within the polling interval', async ({ page }) => {
    let requestCount = 0;

    await page.route(CHANGES_PATTERN, async (route) => {
      if (route.request().method() === 'GET') requestCount++;
      await route.continue();
    });

    await page.goto('/activity');

    // useChanges refetchInterval = 5 000 ms; allow up to 15 s for 2 polls
    await expect.poll(() => requestCount, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  });
});
