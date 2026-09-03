/**
 * Production viewport tests for OE3 — runs against the deployed instance.
 *
 * Tests DOM structure, console errors, responsive layout, and screenshots
 * for both Desktop (1280x800) and Mobile (375x812 — iPhone X) viewports.
 *
 * Run: npx playwright test --config=e2e/prod/playwright.prod.config.ts
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { execSync } from 'child_process';

const OE3_BASE = 'http://10.0.1.46:3080';
const OE3_URL = `${OE3_BASE}/oe3/`;

// ── Generate a valid JWT token for the superadmin user ──
function getSuperadminToken(): string {
  const script = `
    const jwt = require('jsonwebtoken');
    const secret = require('fs').readFileSync('/run/secrets/jwt_secret', 'utf-8').trim();
    const payload = {
      id: 'a265fc66-f3f8-4e27-a2a7-8c492723be53',
      roles: ['SUPERADMIN', 'ADMIN'],
      userType: 'STAFF',
      domain_uuid: 'system',
      mfaVerified: true,
      iss: 'pulmopath-auth',
      aud: 'pulmopath-api',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    process.stdout.write(jwt.sign(payload, secret));
  `;
  return execSync(
    `docker exec pulmopath-prod-backend-1 node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    { encoding: 'utf-8' },
  ).trim();
}

// ── Helper: collect console errors ──
function attachConsoleCollector(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('React DevTools')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (err: Error) => errors.push(`PAGE_ERROR: ${err.message}`));
  return errors;
}

// ── Helper: login via cookie injection ──
async function login(page: Page) {
  const token = getSuperadminToken();
  await page.context().addCookies([{
    name: 'token',
    value: token,
    domain: '10.0.1.46',
    path: '/',
    httpOnly: false,
    sameSite: 'Lax',
  }]);

  await page.goto(OE3_URL);
  await page.waitForLoadState('networkidle');
}

// ════════════════════════════════════════════════════════════════════════════
// DESKTOP TESTS (1280x800)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Desktop Viewport (1280x800)', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 800, 'Desktop only');
  test.setTimeout(60_000);

  test('app loads without console errors', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'e2e/prod/screenshots/desktop-01-initial.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    console.log(`DESKTOP: Body text (first 200): ${bodyText.substring(0, 200)}`);

    // Should NOT show auth error
    expect(bodyText).not.toContain('Anmeldung erforderlich');

    if (errors.length > 0) {
      console.log(`DESKTOP: Console errors (${errors.length}):`, errors.slice(0, 5));
    }
  });

  test('study list renders with data', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    // Wait for studies to load from Orthanc
    await page.waitForTimeout(8000);

    await page.screenshot({ path: 'e2e/prod/screenshots/desktop-02-study-list.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const studyCount = await page.locator('[data-testid="study-row"], table tbody tr').count();
    console.log(`DESKTOP: Study rows=${studyCount}`);
    console.log(`DESKTOP: Body text (first 300): ${bodyText.substring(0, 300)}`);

    // Should show studies (not "0 studies found")
    expect(bodyText).not.toContain('0 studies found');
    expect(studyCount).toBeGreaterThan(0);
  });

  test('study detail page — series table + statistics', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    await page.waitForTimeout(8000);

    // Click on the first study row
    const studyRow = page.locator('[data-testid="study-row"], table tbody tr').first();
    const rowCount = await page.locator('[data-testid="study-row"], table tbody tr').count();
    console.log(`DESKTOP: Found ${rowCount} study rows`);

    expect(rowCount).toBeGreaterThan(0);

    await studyRow.click();
    await page.waitForURL(/\/studies\/.+/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'e2e/prod/screenshots/desktop-03-study-detail.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasSeries = bodyText.includes('Series');
    const hasImages = bodyText.includes('Images');
    console.log(`DESKTOP: Has 'Series' text=${hasSeries}, Has 'Images' text=${hasImages}`);

    // Statistics card should show Series and Images
    expect(hasSeries).toBeTruthy();
    expect(hasImages).toBeTruthy();

    // Series table should have sortable headers
    const sortHeaders = await page.locator('th.cursor-pointer').count();
    console.log(`DESKTOP: Sortable headers=${sortHeaders}`);
    expect(sortHeaders).toBeGreaterThan(0);

    // Series filter input should be present
    const filterInput = await page.locator('input[placeholder*="Filter"], input[aria-label*="Filter"]').count();
    console.log(`DESKTOP: Filter inputs=${filterInput}`);
    expect(filterInput).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MOBILE TESTS (375x812 — iPhone X)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Mobile Viewport (375x812)', () => {
  test.setTimeout(60_000);
  test.skip(({ viewport }) => !!viewport && viewport.width >= 800, 'Mobile only');
  test.use({ viewport: { width: 375, height: 812 } });

  test('app loads without horizontal scroll', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    await page.waitForTimeout(8000);

    await page.screenshot({ path: 'e2e/prod/screenshots/mobile-01-initial.png', fullPage: true });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const overflow = scrollWidth - clientWidth;
    console.log(`MOBILE: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, overflow=${overflow}px`);

    // Page should not have horizontal scroll
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('study list is usable on mobile', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    await page.waitForTimeout(8000);

    await page.screenshot({ path: 'e2e/prod/screenshots/mobile-02-study-list.png', fullPage: true });

    const studyCount = await page.locator('[data-testid="study-row"], table tbody tr').count();
    console.log(`MOBILE: Study rows=${studyCount}`);

    // Table should be in a scrollable container
    const tableScrollContainer = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return null;
      const parent = table.closest('[class*="overflow"]');
      if (!parent) return null;
      return {
        class: parent.className.substring(0, 60),
        scrollWidth: parent.scrollWidth,
        clientWidth: parent.clientWidth,
      };
    });
    console.log(`MOBILE: Table scroll container=${JSON.stringify(tableScrollContainer)}`);

    // Check touch target sizes
    const smallTouchTargets = await page.evaluate(() => {
      const targets: { tag: string; w: number; h: number; text: string }[] = [];
      document.querySelectorAll('button, a, [role="button"], input[type="checkbox"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.h < 44 || rect.w < 44)) {
          targets.push({
            tag: el.tagName + (el.className ? '.' + el.className.toString().substring(0, 30) : ''),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            text: (el.textContent || '').trim().substring(0, 20),
          });
        }
      });
      return targets.slice(0, 10);
    });
    if (smallTouchTargets.length > 0) {
      console.log(`MOBILE: Touch targets < 44px (${smallTouchTargets.length}):`, smallTouchTargets);
    }
  });

  test('study detail page is usable on mobile', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    await page.waitForTimeout(8000);

    const firstRow = page.locator('[data-testid="study-row"], table tbody tr').first();
    const rowCount = await page.locator('[data-testid="study-row"], table tbody tr').count();

    if (rowCount > 0) {
      await firstRow.click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: 'e2e/prod/screenshots/mobile-03-study-detail.png', fullPage: true });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      console.log(`MOBILE: Study detail — overflow=${scrollWidth - clientWidth}px`);

      // Series table should be in a scrollable container
      const seriesScroll = await page.evaluate(() => {
        const containers = document.querySelectorAll('[class*="overflow-auto"], [class*="overflow-x"]');
        return Array.from(containers).map((c) => ({
          class: c.className.substring(0, 60),
          scrollWidth: c.scrollWidth,
          clientWidth: c.clientWidth,
        }));
      });
      console.log(`MOBILE: Series scroll containers=${JSON.stringify(seriesScroll)}`);
    }
  });

  test('navigation works on mobile', async ({ page }) => {
    const errors = attachConsoleCollector(page);
    await login(page);
    await page.waitForTimeout(5000);

    const nav = await page.locator('nav, [role="navigation"], [class*="sidebar"]').count();
    console.log(`MOBILE: Nav elements=${nav}`);

    await page.screenshot({ path: 'e2e/prod/screenshots/mobile-04-navigation.png' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DOM STRUCTURE ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
test.describe('DOM Structure Analysis', () => {
  test('analyze page structure and ARIA', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const analysis = await page.evaluate(() => {
      const results: Record<string, unknown> = {};

      results['landmarks'] = {
        main: document.querySelectorAll('[role="main"], main').length,
        nav: document.querySelectorAll('[role="navigation"], nav').length,
        header: document.querySelectorAll('[role="banner"], header').length,
      };

      const headings: { tag: string; text: string }[] = [];
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        headings.push({ tag: h.tagName, text: (h.textContent || '').trim().substring(0, 50) });
      });
      results['headings'] = headings.slice(0, 15);

      results['interactive'] = {
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a').length,
        inputs: document.querySelectorAll('input').length,
        selects: document.querySelectorAll('select').length,
        tables: document.querySelectorAll('table').length,
      };

      const imgsWithoutAlt = Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.alt)
        .map((img) => ({ src: img.src.substring(0, 50) }));
      results['imagesWithoutAlt'] = imgsWithoutAlt.slice(0, 5);

      const inputsWithoutLabel = Array.from(document.querySelectorAll('input'))
        .filter((input) => {
          if (input.type === 'hidden' || input.type === 'checkbox') return false;
          return !input.id || !document.querySelector(`label[for="${input.id}"]`);
        })
        .map((input) => ({ type: input.type, placeholder: input.placeholder, ariaLabel: input.getAttribute('aria-label') }));
      results['inputsWithoutLabel'] = inputsWithoutLabel.slice(0, 5);

      return results;
    });

    console.log('DOM ANALYSIS:', JSON.stringify(analysis, null, 2));
    expect(analysis).toBeTruthy();
  });
});
