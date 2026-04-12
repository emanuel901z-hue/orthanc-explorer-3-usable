/**
 * Smoke items 12–13: Health banner — degraded and recovery.
 *
 * Checklist:
 *   [12] Orthanc goes offline → within ~15 s the global health banner appears
 *   [13] Orthanc comes back → health banner disappears
 *
 * Implementation: Uses Playwright route interception to simulate network
 * failures instead of stopping the Docker container. This tests the exact
 * same code path (healthTracker.recordFailure() after fetch errors) and
 * runs reliably in CI without Docker access.
 *
 * The health banner requires FAILURE_THRESHOLD (3) consecutive failures
 * before transitioning to "degraded" status (see src/lib/health.ts).
 *
 * For the true Docker-level validation (container stop/start), run the
 * manual items from docs/plans/2026-04-11-v0.1-smoke-checklist.md after
 * this automated suite passes.
 */
import { test, expect } from '@playwright/test';

test.describe('Health banner', () => {
  test('item 12: banner appears after 3 consecutive Orthanc failures', async ({ page }) => {
    // Block all Orthanc proxy requests with 503
    await page.route('**/orthanc-proxy/**', (route) =>
      route.fulfill({ status: 503, body: 'Service Unavailable' }),
    );

    await page.goto('/studies');

    // The studies page fires useStudies (POST /tools/find).
    // TanStack Query retries by default — each retry counts as a separate
    // recordFailure() call, so 3 failures accumulate quickly.
    // Also wait for the changes poller if needed.
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 20_000 });

    // Banner text must not contain PHI (no patient data)
    const bannerText = await page.locator('[role="alert"]').innerText();
    expect(bannerText.toLowerCase()).toMatch(/connection|orthanc|degraded/);
    // Confirm no UIDs or patient-looking strings leaked in
    expect(bannerText).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/); // no IP addresses
  });

  test('item 13: banner disappears when Orthanc recovers', async ({ page }) => {
    // First, simulate an outage so the banner appears
    await page.route('**/orthanc-proxy/**', (route) =>
      route.fulfill({ status: 503, body: 'Service Unavailable' }),
    );

    await page.goto('/studies');
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 20_000 });

    // Remove the interception — requests will reach the real Orthanc again
    await page.unroute('**/orthanc-proxy/**');

    // Reload to trigger fresh requests; the first success resets healthTracker to "healthy"
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Banner must be gone
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 15_000 });
  });
});
