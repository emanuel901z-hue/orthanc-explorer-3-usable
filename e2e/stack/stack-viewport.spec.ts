import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Workspace-stack viewport + functional suite (desktop + mobile projects).
 * Validates the live docker deployment: study list, MWL broker dashboard,
 * navigation, DOM structure, console/page errors, screenshots.
 */

const SCREENSHOT_DIR = join(import.meta.dirname, 'screenshots');

function attachErrorCollectors(page: Page, errors: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        !text.includes('favicon') &&
        !text.includes('React DevTools')
      ) {
        errors.push(`CONSOLE: ${text}`);
      }
    }
  });
  page.on('pageerror', (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  page.on('requestfailed', (req) => {
    // Suppress noise from dev-overlay probes only; real API failures matter.
    errors.push(`REQ_FAILED: ${req.url()} — ${req.failure()?.errorText ?? '?'}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      errors.push(`HTTP_${res.status()}: ${res.url()}`);
    }
  });
}

async function analyzeDom(page: Page, label: string) {
  const analysis = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth;
    return {
      title: document.title,
      h1Count: document.querySelectorAll('h1').length,
      h1Text: [...document.querySelectorAll('h1')].map((h) => h.textContent?.trim()),
      landmarks: {
        nav: document.querySelectorAll('nav, [role="navigation"]').length,
        main: document.querySelectorAll('main, [role="main"]').length,
      },
      tables: document.querySelectorAll('table').length,
      buttons: document.querySelectorAll('button').length,
      links: document.querySelectorAll('a[href]').length,
      inputs: document.querySelectorAll('input, select, textarea').length,
      imgsWithoutAlt: [...document.querySelectorAll('img')].filter((i) => !i.alt).length,
      horizontalOverflow: overflow,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyHeight: document.body.scrollHeight,
    };
  });
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SCREENSHOT_DIR, `dom-${label}-${test.info().project.name}.json`),
    JSON.stringify(analysis, null, 2),
  );
  return analysis;
}

test.describe('stack: study list', () => {
  test('loads study list from Orthanc without errors', async ({ page }) => {
    const errors: string[] = [];
    attachErrorCollectors(page, errors);

    await page.goto('/oe3/');
    // Should redirect to /studies and render the list (stack has ≥1 study).
    // Mobile renders cards, desktop a table — the count label works for both.
    await expect(page).toHaveURL(/\/studies/, { timeout: 15000 });
    await expect(page.getByText(/studies found|Studien gefunden/i)).toBeVisible({ timeout: 15000 });

    const dom = await analyzeDom(page, 'studies');
    expect(dom.h1Count).toBe(1);
    expect(dom.horizontalOverflow).toBe(false);

    await page.waitForTimeout(600);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `studies-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, `browser errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('stack: MWL broker dashboard', () => {
  test('renders broker status, echo matrix and query log', async ({ page }) => {
    const errors: string[] = [];
    attachErrorCollectors(page, errors);

    await page.goto('/oe3/broker');
    await expect(page.locator('h1')).toContainText(/MWL/i, { timeout: 15000 });

    // Status cards render — i18n titles (de: "Config-DB", en: "Config DB")
    await expect(page.getByText('DICOM SCP')).toBeVisible();
    await expect(page.getByText(/Config.?DB/i)).toBeVisible();

    // Sources table — mock RIS endpoints with AE/host:port detail
    await expect(page.getByText(/RIS_A@mock-ris-a:11114/)).toBeVisible();
    await expect(page.getByText(/RIS_B@mock-ris-b:11115/)).toBeVisible();

    // Targets — orthanc default + pacs-peer
    await expect(page.getByText(/ORTHANC@orthanc:4242/)).toBeVisible();
    await expect(page.getByText(/PEER@dicom-peer:4242/)).toBeVisible();

    // Echo badges eventually show RTT (health loop may need a few seconds)
    await expect(page.getByText(/\d+\s*ms/).first()).toBeVisible({ timeout: 20000 });

    // Query log has rows (the earlier C-FIND through the broker)
    await expect(page.locator('tbody tr').first()).toBeVisible();

    const dom = await analyzeDom(page, 'broker');
    expect(dom.h1Count).toBe(1);
    expect(dom.horizontalOverflow).toBe(false);
    expect(dom.tables).toBeGreaterThanOrEqual(3); // sources + targets + query log
    expect(dom.imgsWithoutAlt).toBe(0);

    await page.waitForTimeout(600); // let mount fade-in finish before the shot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `broker-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, `browser errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('manual echo button triggers without errors', async ({ page }) => {
    const errors: string[] = [];
    attachErrorCollectors(page, errors);

    await page.goto('/oe3/broker');
    await expect(page.locator('h1')).toContainText(/MWL/i, { timeout: 15000 });

    const echoBtn = page.getByRole('button', { name: /echo/i }).first();
    await expect(echoBtn).toBeVisible();
    await echoBtn.click();
    // RTT badge should appear/refresh
    await expect(page.getByText(/\d+\s*ms/).first()).toBeVisible({ timeout: 15000 });

    expect(errors, `browser errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('stack: navigation', () => {
  test('navigates to broker page via sidebar', async ({ page }) => {
    const errors: string[] = [];
    attachErrorCollectors(page, errors);

    await page.goto('/oe3/studies');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    const isMobile = test.info().project.name === 'mobile';
    if (isMobile) {
      // Open the mobile sidebar sheet (hamburger trigger)
      const trigger = page.getByRole('button').filter({ has: page.locator('svg') }).first();
      await trigger.tap();
      await page.waitForTimeout(400); // sheet animation
    }

    await page.getByRole('link', { name: /MWL|Broker/i }).first().click();
    await expect(page).toHaveURL(/\/broker/);
    await expect(page.locator('h1')).toContainText(/MWL/i);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, `nav-broker-${test.info().project.name}.png`),
      fullPage: true,
    });
    expect(errors, `browser errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
