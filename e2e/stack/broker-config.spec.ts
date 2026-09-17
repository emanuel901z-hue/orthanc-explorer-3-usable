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
    // unique per run — a leftover rule from an earlier run would make the
    // create fail with 409 and leave the modal open
    const ruleName = `e2e-institution-${Date.now().toString(36)}`;

    await openPage(page, '/oe3/broker/transforms', /modify rules|modify-regeln/i);
    // the empty state only applies to a pristine stack — a failed earlier run
    // may have left rules behind, so don't depend on it
    const emptyState = page.getByText(/no modify rules|keine modify-regeln/i);
    if ((await emptyState.count()) > 0) await expect(emptyState).toBeVisible();

    // create
    await page.getByRole('button', { name: /add modify rule|modify-regel hinzufügen/i }).click();
    await page.getByLabel(/^name$/i).fill(ruleName);
    await page.getByLabel(/dicom tag/i).fill('InstitutionName');
    await page.getByLabel(/^value$/i).fill('E2E Klinikum');
    await page.getByRole('button', { name: /^save$|^speichern$/i }).click();

    const row = page.locator('tr, [data-testid="config-row"]').filter({ hasText: ruleName });
    await expect(row).toBeVisible({ timeout: 15000 });
    // the operations column is hidden below md — assert presence, not visibility
    await expect(row.getByText('set InstitutionName')).toBeAttached();

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-transforms-${test.info().project.name}.png`),
      fullPage: true,
    });

    // delete (scoped to the row we just created)
    await row.getByRole('button', { name: /delete modify rule|modify-regel löschen/i }).click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();
    await expect(page.getByText(ruleName)).toHaveCount(0, { timeout: 15000 });

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

  test('health panel renders the configuration checks', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker', /MWL/i);

    const panel = page.getByTestId('broker-health');
    await expect(panel).toBeVisible();
    // the test stack has no AET allowlist → the info-level note is always there
    await expect(panel.getByText(/allowlist|Allowlist/i)).toBeVisible();
    await assertNoOverflow(page, 'broker-health');

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-health-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('open circuit breaker is visible and can be reset by the operator', async ({ page }) => {
    // requires the test-stack scenario (test-stack.sh trips the breaker for
    // the deliberately dead source 'e2e-dead' before Playwright runs)
    const status = await (await page.request.get('/broker-api/api/v1/status')).json();
    const dead = (status.sources as Array<{ name: string; breaker_state?: string }>)
      .find((s) => s.name === 'e2e-dead');
    test.skip(!dead || dead.breaker_state !== 'open', 'breaker scenario not prepared');

    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker/sources', /upstream sources|upstream-quellen/i);
    await expect(page.getByText(/breaker open/i).first()).toBeVisible();

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-breaker-${test.info().project.name}.png`),
      fullPage: true,
    });

    // the health panel reports it as well
    await openPage(page, '/oe3/broker', /MWL/i);
    await expect(page.getByTestId('broker-health').getByText(/temporarily skipped|übersprungen/i))
      .toBeVisible();

    // operator reset → the badge disappears
    await openPage(page, '/oe3/broker/sources', /upstream sources|upstream-quellen/i);
    await page.getByRole('button', { name: /reset circuit breaker|breaker zurücksetzen/i })
      .first().click();
    await expect(page.getByText(/breaker open/i)).toHaveCount(0, { timeout: 15000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('case check simulates routing for a known worklist item', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker', /MWL/i);
    const panel = page.getByTestId('broker-case-check');
    await expect(panel).toBeVisible();

    // the C-FIND smoke (run by test-stack.sh before the suite) recorded this
    // accession in seen_items, so the routing rule must win
    await panel.getByLabel(/accession number/i).fill('ACC-A-001');
    await panel.getByLabel(/tag values to test/i).fill('PatientID=P1001');
    await panel.getByRole('button', { name: /run check/i }).click();

    const result = panel.getByTestId('case-check-result');
    await expect(result).toBeVisible({ timeout: 15000 });
    await expect(result).toContainText(/matched via accession|Treffer über Accession/i);
    await expect(result).toContainText('ris-a');
    await expect(result).toContainText('pacs-peer');

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-case-check-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('case check falls back to the default target for an unknown case', async ({ page }) => {
    await openPage(page, '/oe3/broker', /MWL/i);
    const panel = page.getByTestId('broker-case-check');

    await panel.getByLabel(/accession number/i).fill('E2E-UNKNOWN-ACC');
    await panel.getByRole('button', { name: /run check/i }).click();

    const result = panel.getByTestId('case-check-result');
    await expect(result).toBeVisible({ timeout: 15000 });
    await expect(result).toContainText(/default target|Default-Ziel/i);
    await expect(result).toContainText('orthanc');
  });

  test('change log records a configuration change and rolls it back', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);
    const name = `e2e-audit-${Date.now().toString(36)}`;

    // 1. create a source through the UI
    await openPage(page, '/oe3/broker/sources', /upstream sources|upstream-quellen/i);
    await page.getByRole('button', { name: /add source|quelle hinzufügen/i }).click();
    await page.getByLabel(/^name$/i).fill(name);
    // anchored: "Calling AE title" must not match as well
    await page.getByLabel(/^ae ?title$|^ae-titel$/i).fill('AUDIT');
    await page.getByLabel(/^host$/i).fill('127.0.0.1');
    await page.getByLabel(/^port$/i).fill('11198');
    await page.getByRole('button', { name: /^save$|^speichern$/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15000 });

    // 2. the change log shows it
    await openPage(page, '/oe3/broker/audit', /change log|änderungsprotokoll/i);
    const row = page.locator('tr, [data-testid="config-row"]').filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText(/created|angelegt/i);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-audit-${test.info().project.name}.png`),
      fullPage: true,
    });

    // 3. the diff shows the field values
    await row.getByRole('button', { name: /show changes|änderungen anzeigen/i }).click();
    await expect(page.getByRole('dialog')).toContainText('aet');
    // Radix adds its own close icon — Escape is the unambiguous way out
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 4. rollback removes the source again
    await row.getByRole('button', { name: /roll this change back|zurücksetzen/i }).click();
    await page.getByRole('button', { name: /^delete$|^löschen$/i }).click();

    await openPage(page, '/oe3/broker/sources', /upstream sources|upstream-quellen/i);
    await expect(page.getByText(name)).toHaveCount(0, { timeout: 15000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('cache card shows the outage bridge state', async ({ page }) => {
    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker', /MWL/i);
    const card = page.getByTestId('broker-cache');
    await expect(card).toBeVisible();
    // the C-FIND smoke ran before the suite → the snapshot is filled
    await expect(card.getByTestId('broker-cache-list')).toBeVisible();
    await expect(card).toContainText(/ris-a/);
    await expect(card).toContainText(/items/i);
    // the semantics are explained (upstream stays the source of truth)
    await expect(card).toContainText(/source of truth|Quelle der Wahrheit/i);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-cache-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('stale answers are visible in the dashboard', async ({ page }) => {
    // requires the test-stack scenario: test-stack.sh makes a source
    // unreachable once and queries it, so the newest log entry is stale
    const logs = await (await page.request.get('/broker-api/api/v1/logs/queries?limit=1')).json();
    const stale = (logs[0]?.served_stale ?? []) as string[];
    test.skip(stale.length === 0, 'stale scenario not prepared');

    const errors: string[] = [];
    collectErrors(page, errors);

    await openPage(page, '/oe3/broker', /MWL/i);
    const banner = page.getByTestId('broker-stale-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(stale[0]);
    await expect(banner).toContainText(/from cache|aus dem Cache/i);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-stale-${test.info().project.name}.png`),
      fullPage: true,
    });
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
