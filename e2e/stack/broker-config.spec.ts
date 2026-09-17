import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Broker configuration pages against the live test stack.
 *
 * Covers rendering of the seeded configuration, the sidebar sub-navigation
 * and two full CRUD round-trips (transform rule + runtime setting) that go
 * through the real REST API and database.
 */

const SCREENSHOT_DIR = join(import.meta.dirname, 'screenshots');

function collectErrors(page: Page, errors: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('React DevTools')) {
        errors.push(`CONSOLE: ${text}`);
      }
    }
  });
  page.on('pageerror', (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  page.on('response', (res) => {
    // 422 is expected in the validation test — filtered there via expectNoErrors flag
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      errors.push(`HTTP_${res.status()}: ${res.url()}`);
    }
  });
}

async function openPage(page: Page, path: string, h1: RegExp) {
  await page.goto(path);
  await expect(page.locator('h1')).toContainText(h1, { timeout: 15000 });
  await page.waitForTimeout(400); // let queries settle before DOM assertions
}

async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    h1Count: document.querySelectorAll('h1').length,
  }));
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SCREENSHOT_DIR, `dom-${label}-${test.info().project.name}.json`),
    JSON.stringify(overflow, null, 2),
  );
  expect(overflow.h1Count, 'exactly one h1 per page').toBe(1);
  expect(overflow.page, 'no horizontal page overflow').toBe(false);
}

test.describe('stack: broker config pages', () => {
  test('sources page lists the seeded upstream systems', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/sources', /upstream sources|upstream-quellen/i);
    await expect(page.getByText('RIS_A@mock-ris-a:11114')).toBeVisible();
    await expect(page.getByText('RIS_B@mock-ris-b:11115')).toBeVisible();
    await assertNoOverflow(page, 'broker-sources');

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-sources-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('targets page marks the default destination', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/targets', /store targets|store-ziele/i);
    await expect(page.getByText('ORTHANC@orthanc:4242')).toBeVisible();
    await expect(page.getByText('PEER@dicom-peer:4242')).toBeVisible();
    await expect(page.getByText('default').first()).toBeVisible();
    await assertNoOverflow(page, 'broker-targets');

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-targets-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('rules page shows the seeded routing rule', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/rules', /routing rules|routing-regeln/i);
    await expect(page.getByText('ris-a')).toBeVisible();
    await expect(page.getByText('pacs-peer')).toBeVisible();
    await assertNoOverflow(page, 'broker-rules');

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-rules-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('transform rule: create, verify, delete (full API round-trip)', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/transforms', /modify rules|modify-regeln/i);
    await expect(page.getByText(/no modify rules|keine modify-regeln/i)).toBeVisible();

    // create
    await page.getByRole('button', { name: /add modify rule|modify-regel hinzufügen/i }).click();
    await page.getByLabel(/^name$/i).fill('e2e-institution');
    await page.getByLabel(/dicom tag/i).fill('InstitutionName');
    await page.getByLabel(/^value$/i).fill('E2E Klinikum');
    await page.getByRole('button', { name: /^save$|^speichern$/i }).click();

    await expect(page.getByText('e2e-institution')).toBeVisible({ timeout: 15000 });
    // the operations column is hidden below md — assert presence, not visibility
    await expect(page.getByText('set InstitutionName')).toBeAttached();

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-transforms-${test.info().project.name}.png`),
      fullPage: true,
    });

    // delete
    await page.getByRole('button', { name: /delete modify rule|modify-regel löschen/i }).click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();
    await expect(page.getByText('e2e-institution')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText(/no modify rules|keine modify-regeln/i)).toBeVisible();

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('transform rule: invalid DICOM tag is rejected with the server message', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/transforms', /modify rules|modify-regeln/i);
    await page.getByRole('button', { name: /add modify rule|modify-regel hinzufügen/i }).click();
    await page.getByLabel(/^name$/i).fill('e2e-invalid');
    await page.getByLabel(/dicom tag/i).fill('NotARealTag');
    await page.getByRole('button', { name: /^save$|^speichern$/i }).click();

    // backend validation (422) surfaces in the dialog
    await expect(page.getByRole('alert')).toContainText(/unknown DICOM keyword/i, { timeout: 15000 });
    await expect(page.getByText('e2e-invalid')).toHaveCount(0);

    // close without saving
    await page.getByRole('button', { name: /^cancel$|^abbrechen$/i }).click();

    // the expected 422 (and its logged fetch failure) is not a page error
    const unexpected = errors.filter(
      (e) => !e.includes('HTTP_422') && !e.includes('422') && !e.includes('broker.fetch.failed'),
    );
    expect(unexpected, unexpected.join('\n')).toEqual([]);
  });

  test('runtime setting: override then reset to the ENV default', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/settings', /broker settings|broker-einstellungen/i);

    // scope everything to the one setting row (other rows have their own buttons)
    const row = page.getByTestId('setting-echo_interval_s');
    const envBadge = row.getByText(/^(from \.env|aus \.env)$/);
    const resetButton = row.getByRole('button', { name: /reset to default|auf default zurücksetzen/i });
    await expect(row).toBeVisible();

    // idempotent: a previous run may have left an override behind
    if (await resetButton.count() > 0) {
      await resetButton.click();
      await expect(envBadge).toBeVisible({ timeout: 15000 });
    } else {
      await expect(envBadge).toBeVisible();
    }

    await row.getByLabel(/C-ECHO interval|C-ECHO-Intervall/i).fill('45');
    await row.getByRole('button', { name: /^save$|^speichern$/i }).click();

    await expect(row.getByText(/^override$|^Override$/)).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-settings-${test.info().project.name}.png`),
      fullPage: true,
    });

    await resetButton.click();
    await expect(envBadge).toBeVisible({ timeout: 15000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('sidebar sub-navigation reaches every configuration page', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker', /MWL/i);
    const isMobile = test.info().project.name === 'mobile';

    const openSidebar = async () => {
      if (!isMobile) return;
      await page.getByRole('button').filter({ has: page.locator('svg') }).first().tap();
      await page.waitForTimeout(400);
    };

    for (const [label, url] of [
      [/upstream sources|upstream-quellen/i, /\/broker\/sources/],
      [/store targets|store-ziele/i, /\/broker\/targets/],
      [/routing rules|routing-regeln/i, /\/broker\/rules/],
      [/modify rules|modify-regeln/i, /\/broker\/transforms/],
      [/broker settings|broker-einstellungen/i, /\/broker\/settings/],
    ] as const) {
      await openSidebar();
      await page.getByRole('link', { name: label }).first().click();
      await expect(page).toHaveURL(url);
    }

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
