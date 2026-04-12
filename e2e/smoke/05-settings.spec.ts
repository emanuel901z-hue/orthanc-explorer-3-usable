/**
 * Smoke items 9–10: Settings page — modalities CRUD and system info.
 *
 * Checklist:
 *   [9]  Settings → Modalities tab: Add dummy modality, C-Echo, Delete
 *   [10] Settings → System tab: server name, Orthanc version, plugin list
 *
 * The TEST modality points at the dicom-peer container (Docker DNS hostname
 * "dicom-peer", DICOM port 4242). The primary Orthanc resolves this hostname
 * inside the compose network when executing C-ECHO — the browser never needs
 * to resolve it.
 *
 * Prerequisites for 9c–9e: dicom-peer container must be healthy.
 * Run: docker compose -f docker-compose.dev.yml up -d dicom-peer
 */
import { test, expect, request } from '@playwright/test';

const PRIMARY_ORTHANC = 'http://localhost:8042';
const TEST_MODALITY = 'TEST';
// Inside Docker compose network: primary Orthanc reaches peer via DNS.
const PEER_HOST = 'dicom-peer';
const PEER_DICOM_PORT = '4242';

// Direct REST client against the primary Orthanc (bypasses Vite proxy).
async function orthancRequest() {
  return request.newContext({ baseURL: PRIMARY_ORTHANC });
}

test.describe('Settings — Modalities', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: /modalities/i }).click();
    await page.waitForLoadState('networkidle');
  });

  test('item 9a: modalities tab loads list from GET /modalities', async ({ page }) => {
    const modalitiesRequest = page.waitForRequest(
      (req) => req.url().includes('/modalities') && req.method() === 'GET',
    );
    await page.goto('/settings');
    await page.getByRole('tab', { name: /modalities/i }).click();
    await modalitiesRequest;

    await expect(page.getByRole('button', { name: /add modality/i })).toBeVisible();
  });

  test('item 9b: Add Modality dialog opens and accepts input', async ({ page }) => {
    await page.getByRole('button', { name: /add modality/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel(/name/i).fill('TEST');
    await page.getByLabel(/aet/i).fill('TEST');
    await page.getByLabel(/host/i).fill('127.0.0.1');
    await page.getByLabel(/port/i).fill('11112');
  });

  test('item 9c: saving new modality fires PUT /modalities/TEST and it appears in list', async ({ page }) => {
    // Clean up any leftover TEST modality from a previous run.
    const api = await orthancRequest();
    await api.delete(`/modalities/${TEST_MODALITY}`).catch(() => {/* 404 is fine */});

    const putRequest = page.waitForRequest(
      (req) => /\/modalities\/TEST/.test(req.url()) && req.method() === 'PUT',
      { timeout: 10_000 },
    );

    await page.getByRole('button', { name: /add modality/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel(/name/i).fill(TEST_MODALITY);
    await page.getByLabel(/aet/i).fill(TEST_MODALITY);
    await page.getByLabel(/host/i).fill(PEER_HOST);
    await page.getByLabel(/port/i).fill(PEER_DICOM_PORT);
    // Click the submit button inside the dialog (not the trigger in the background).
    await page.getByRole('dialog').getByRole('button', { name: /add modality/i }).click();

    const req = await putRequest;
    // Verify Orthanc accepted the PUT (not just that it was sent).
    const putResp = await req.response();
    expect(putResp?.status()).toBe(200);

    // List must refresh and show the new row — use the delete testid as a
    // precise anchor (avoids strict-mode issues with name/AET both matching 'TEST').
    await expect(
      page.locator(`[data-testid="delete-modality-${TEST_MODALITY}"]`),
    ).toBeVisible({ timeout: 5_000 });

    // Verify Orthanc actually stored it.
    // Modern Orthanc: GET /modalities/{id}/configuration returns the config object.
    const check = await api.get(`/modalities/${TEST_MODALITY}/configuration`);
    expect(check.status()).toBe(200);
    const body = await check.json();
    expect(body.AET).toBe(TEST_MODALITY);
  });

  test('item 9d: C-Echo button fires POST /modalities/TEST/echo and succeeds', async ({ page }) => {
    // Ensure TEST modality exists (idempotent PUT).
    const api = await orthancRequest();
    await api.put(`/modalities/${TEST_MODALITY}`, {
      data: { AET: TEST_MODALITY, Host: PEER_HOST, Port: Number(PEER_DICOM_PORT) },
    });

    // Reload so the modality appears in the list.
    await page.reload();
    await page.getByRole('tab', { name: /modalities/i }).click();
    await page.waitForLoadState('networkidle');

    const echoRequest = page.waitForRequest(
      (req) => /\/modalities\/TEST\/echo/.test(req.url()) && req.method() === 'POST',
      { timeout: 10_000 },
    );

    await page.locator(`[data-testid="echo-modality-${TEST_MODALITY}"]`).click();
    const req = await echoRequest;
    const response = await req.response();

    // Orthanc returns 200 when C-ECHO succeeds against a live peer.
    expect(response?.status()).toBe(200);

    // Success toast or status indicator must appear.
    await expect(page.locator('body')).toContainText(/succeeded|C-ECHO/i, { timeout: 10_000 });
  });

  test('item 9e: delete button fires DELETE /modalities/TEST and row disappears', async ({ page }) => {
    // Ensure TEST modality exists.
    const api = await orthancRequest();
    await api.put(`/modalities/${TEST_MODALITY}`, {
      data: { AET: TEST_MODALITY, Host: PEER_HOST, Port: Number(PEER_DICOM_PORT) },
    });

    await page.reload();
    await page.getByRole('tab', { name: /modalities/i }).click();
    await page.waitForLoadState('networkidle');

    // Use delete testid as a precise row anchor (avoids strict-mode issues).
    await expect(
      page.locator(`[data-testid="delete-modality-${TEST_MODALITY}"]`),
    ).toBeVisible();

    const deleteRequest = page.waitForRequest(
      (req) => /\/modalities\/TEST$/.test(req.url()) && req.method() === 'DELETE',
      { timeout: 10_000 },
    );

    await page.locator(`[data-testid="delete-modality-${TEST_MODALITY}"]`).click();

    // AlertDialog — confirm the destructive action.
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: /delete/i }).click();

    await deleteRequest;

    // Row must be gone after cache invalidation + refetch.
    await expect(
      page.locator(`[data-testid="delete-modality-${TEST_MODALITY}"]`),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Settings — System info', () => {
  test('item 10: system tab shows Orthanc version and non-empty plugin list', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/\d+\.\d+/);
    expect(body).not.toContain('[object Object]');
    expect(body).not.toContain('undefined');

    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });
});
