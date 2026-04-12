/**
 * Smoke item 7: Upload page.
 *
 * Checklist:
 *   [7] Drag test-data/sample.dcm onto drop zone → upload completes
 *       Network tab shows POST /instances with Content-Type: application/dicom
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Upload', () => {
  test('item 7a: drop zone is visible and file input is present', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.locator('[data-testid="upload-drop-zone"]')).toBeVisible();
    // Hidden file inputs must exist for the select-files and select-folder buttons
    const fileInputs = page.locator('input[type="file"]');
    expect(await fileInputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('item 7b: selecting a .dcm file adds it to the job queue', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForSelector('[data-testid="upload-drop-zone"]');

    const filePath = path.resolve('test-data/sample.dcm');
    // Use the hidden file input — more reliable than simulating drag events
    await page.locator('input[type="file"]').first().setInputFiles(filePath);

    // The job queue table should appear with the filename
    await expect(page.locator('text=sample.dcm')).toBeVisible({ timeout: 10_000 });
  });

  test(
    'item 7c: upload sends POST /instances with Content-Type: application/dicom',
    async ({ page }) => {
      const uploadRequest = page.waitForRequest(
        (req) => req.url().includes('/instances') && req.method() === 'POST',
      );

      await page.goto('/upload');
      const filePath = path.resolve('test-data/sample.dcm');
      await page.locator('input[type="file"]').first().setInputFiles(filePath);

      const req = await uploadRequest;
      expect(req.headers()['content-type']).toMatch(/application\/dicom/);
    },
  );
});
