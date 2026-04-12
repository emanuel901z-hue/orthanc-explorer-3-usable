/**
 * Smoke item 11: Delete study + audit trail.
 *
 * Checklist:
 *   [11] Navigate to a study detail page → click Delete → confirm
 *        - Browser console shows audit log: { action: "study.delete", outcome: "success" }
 *        - Study list no longer shows the deleted study
 *        - React Query cache is invalidated (no stale row)
 *
 * NOTE: After this test, re-seed before the health-banner test:
 *   docker compose -f docker-compose.dev.yml --profile seed up seeder
 */
import { test, expect } from '@playwright/test';

test.describe('Study delete action', () => {
  test('item 11: delete study fires DELETE request and emits audit event', async ({ page }) => {
    // Capture audit log entries from console.log (logger → defaultSink → console.log)
    const auditEntries: unknown[] = [];
    page.on('console', async (msg) => {
      if (msg.type() === 'log') {
        try {
          const arg = await msg.args()[0]?.jsonValue();
          if (
            arg &&
            typeof arg === 'object' &&
            (arg as Record<string, unknown>).event === 'audit'
          ) {
            auditEntries.push(arg);
          }
        } catch {
          // jsonValue() can fail for certain handle types — safe to ignore
        }
      }
    });

    // Navigate to the study list and pick the first study
    await page.goto('/studies');
    await page.waitForSelector('[data-testid="study-row"]');
    await page.locator('[data-testid="study-row"]').first().click();
    await expect(page).toHaveURL(/\/studies\/.+/);

    // Intercept the DELETE request
    const deleteRequest = page.waitForRequest(
      (req) =>
        /\/studies\/[^/]+$/.test(req.url()) &&
        req.method() === 'DELETE',
      { timeout: 15_000 },
    );

    // Open the delete confirmation dialog
    await page.getByRole('button', { name: /delete/i }).first().click();
    // The AlertDialog trigger is already the button; the confirmation "Delete" is inside the dialog
    const confirmBtn = page.getByRole('alertdialog').getByRole('button', { name: /delete/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify DELETE request fired
    const req = await deleteRequest;
    expect(req.method()).toBe('DELETE');
    expect(req.url()).toMatch(/\/studies\/[^/]+$/);

    // After deletion, app navigates back to /studies
    await expect(page).toHaveURL('/studies', { timeout: 10_000 });

    // Verify audit event was emitted to console
    await page.waitForTimeout(500); // brief settle for async console flush
    const deleteAudit = auditEntries.find(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        (e as Record<string, unknown>).event === 'audit' &&
        ((e as Record<string, unknown>).fields as Record<string, unknown>)?.action ===
          'study.delete',
    );
    expect(
      deleteAudit,
      'Expected an audit entry with action="study.delete" in console output',
    ).toBeTruthy();
  });
});
