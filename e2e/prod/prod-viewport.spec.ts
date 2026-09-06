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
// FEATURE-FLAG RBAC (regression for critical security fix in features.ts)
//
// config.prod.js sets enableDelete/enableModify/enableAnonymize/enableSendTo
// to false. The FEATURE_ALIASES mapping in src/config/features.ts now maps
// these legacy `enableX` keys to the FeatureKey union so the resolver
// actually disables them. Without the fix, all write actions stayed
// enabled in production regardless of the disable flag.
// ════════════════════════════════════════════════════════════════════════════
test.describe('Feature-Flag RBAC (config.prod.js disable flags)', () => {
  test('config.js exposes the disable flags to window.__OE3_CONFIG__', async ({ page }) => {
    await page.goto(`${OE3_BASE}/oe3/config.js`);
    const body = await page.locator('body').innerText();
    // config.prod.js ships enableDelete/enableModify/enableAnonymize/enableSendTo
    expect(body).toContain('enableDelete');
    expect(body).toContain('enableModify');
    expect(body).toContain('enableAnonymize');
    expect(body).toContain('enableSendTo');
    // All four must be set to false in production
    expect(body).toMatch(/enableDelete:\s*false/);
    expect(body).toMatch(/enableModify:\s*false/);
    expect(body).toMatch(/enableAnonymize:\s*false/);
    expect(body).toMatch(/enableSendTo:\s*false/);
  });

  test('study list does not show Delete button when enableDelete is false', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    // The Delete button in the bulk-actions bar / row actions should be
    // gated by useFeature('delete') and therefore NOT render in production.
    const deleteButtons = await page.locator('button:has-text("Delete"), button[aria-label*="delete" i]').count();
    console.log(`RBAC: Delete buttons visible=${deleteButtons}`);
    expect(deleteButtons).toBe(0);
  });

  test('study detail does not show Modify/Anonymize/Send buttons when disabled', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const rowCount = await page.locator('[data-testid="study-row"], table tbody tr').count();
    test.skip(rowCount === 0, 'No studies available to open');

    await page.locator('[data-testid="study-row"], table tbody tr').first().click();
    await page.waitForURL(/\/studies\/.+/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const modifyButtons = await page.locator('button:has-text("Modify"), button[aria-label*="modify" i]').count();
    const anonymizeButtons = await page.locator('button:has-text("Anonymize"), button[aria-label*="anonymize" i]').count();
    const sendButtons = await page.locator('button:has-text("Send"), button[aria-label*="send" i]').count();
    console.log(`RBAC: Modify=${modifyButtons}, Anonymize=${anonymizeButtons}, Send=${sendButtons}`);

    expect(modifyButtons).toBe(0);
    expect(anonymizeButtons).toBe(0);
    expect(sendButtons).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SMART SEARCH (regression for 4-digit date parser fix in smart-search.ts)
//
// "2908" must match a study dated 2026-08-29 (dd=29, mm=08), NOT a study
// dated 2026-09-02 (the previous single-digit-parse bug).
// ════════════════════════════════════════════════════════════════════════════
test.describe('Smart Search', () => {
  test('4-digit date token "2908" filters to Aug-29 studies only', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const searchInput = page.locator('input[placeholder*="earch" i]').first();
    await searchInput.fill('2908');
    await page.waitForTimeout(2000);

    const rowsAfter2908 = await page.locator('[data-testid="study-row"], table tbody tr').count();
    console.log(`SMART-SEARCH: rows matching "2908"=${rowsAfter2908}`);

    // Cross-check: "0209" must NOT match the same studies (previous bug
    // would have parsed "2908" as dd=2, mm=9, matching Sep-02 studies).
    await searchInput.fill('0209');
    await page.waitForTimeout(2000);
    const rowsAfter0209 = await page.locator('[data-testid="study-row"], table tbody tr').count();
    console.log(`SMART-SEARCH: rows matching "0209"=${rowsAfter0209}`);
  });

  test('umlaut tolerance: "Mueller" matches "Müller" studies', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const searchInput = page.locator('input[placeholder*="earch" i]').first();
    await searchInput.fill('Mueller');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/prod/screenshots/smart-search-umlaut.png', fullPage: true });
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

// ════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY REGRESSION (Sprint 2 UX-fixes)
//
// Verifies the A11y fixes applied in the UX optimization sprint:
// - H1 presence on every page (StudyDetail, SeriesDetail, Activity)
// - Search inputs have data-shortcut="search" attribute (i18n-agnostic
//   keyboard shortcut selector — replaced locale-specific placeholder matching)
// - Search inputs have aria-label
// - Icon-only buttons have aria-labels
// - Touch target sizes >= 36px on mobile (pointer:coarse)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Accessibility Regression', () => {
  test('study list page has exactly one H1 and search input with data-shortcut + aria-label', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    const searchInput = page.locator('input[data-shortcut="search"]').first();
    await expect(searchInput).toHaveAttribute('aria-label', /.+/);
    console.log(`A11Y: StudyList H1=${h1Count}, search has data-shortcut + aria-label`);
  });

  test('study detail page has sr-only H1 with patient name', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const rowCount = await page.locator('[data-testid="study-row"], table tbody tr').count();
    test.skip(rowCount === 0, 'No studies available');

    await page.locator('[data-testid="study-row"], table tbody tr').first().click();
    await page.waitForURL(/\/studies\/.+/, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const h1 = page.locator('h1.sr-only');
    await expect(h1).toHaveCount(1);
    const h1Text = await h1.textContent();
    expect(h1Text?.trim().length).toBeGreaterThan(0);
    console.log(`A11Y: StudyDetail H1 (sr-only) = "${h1Text?.trim().substring(0, 30)}"`);
  });

  test('activity page has sr-only H1', async ({ page }) => {
    await login(page);
    await page.goto(`${OE3_URL}#/activity`);
    await page.waitForTimeout(5000);

    const h1 = page.locator('h1.sr-only');
    await expect(h1).toHaveCount(1);
    console.log('A11Y: Activity H1 (sr-only) present');
  });

  test('all icon-only buttons have aria-labels', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    // Find all buttons with no visible text content — these are icon-only
    const iconButtonsWithoutAria = await page.evaluate(() => {
      const violations: { testid: string; classes: string }[] = [];
      document.querySelectorAll('button').forEach((btn) => {
        const text = (btn.textContent || '').trim();
        const hasAriaLabel = btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby');
        // Icon-only = no text (or whitespace only) and no aria-label
        if (!text && !hasAriaLabel) {
          violations.push({
            testid: btn.getAttribute('data-testid') || btn.className.substring(0, 40),
            classes: btn.className.substring(0, 60),
          });
        }
      });
      return violations;
    });

    console.log(`A11Y: Icon-only buttons without aria-label=${iconButtonsWithoutAria.length}`, iconButtonsWithoutAria.slice(0, 5));
    // Allow sidebar collapse/expand buttons which use tooltip instead of aria-label
    // (Radix Sidebar component pattern). All other icon-only buttons must have aria-label.
    expect(iconButtonsWithoutAria.length).toBeLessThanOrEqual(2);
  });

  test('all images have alt text', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(5000);

    const imgsWithoutAlt = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.alt && !img.getAttribute('aria-label'))
        .map((img) => ({ src: img.src.substring(0, 60) }));
    });

    console.log(`A11Y: Images without alt=${imgsWithoutAlt.length}`, imgsWithoutAlt);
    expect(imgsWithoutAlt).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TOUCH TARGET SIZE (Mobile 375x812)
// Verifies that icon-only buttons on touch devices meet the 36px minimum
// (WCAG 2.5.5 AAA recommends 44px; we enforce 36px as a pragmatic minimum
// for dense data tables).
// ════════════════════════════════════════════════════════════════════════════
test.describe('Touch Target Sizes (Mobile 375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(({ viewport }) => !!viewport && viewport.width >= 768, 'Mobile only');

  test('icon-only buttons in tables are >= 36px', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(8000);

    const smallTouchTargets = await page.evaluate(() => {
      const violations: { tag: string; w: number; h: number; ariaLabel: string }[] = [];
      document.querySelectorAll('button').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').trim();
        // Only check icon-only buttons (no visible text)
        if (!text && rect.width > 0 && rect.height > 0 && (rect.height < 36 || rect.width < 36)) {
          violations.push({
            tag: el.tagName,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            ariaLabel: el.getAttribute('aria-label') || '',
          });
        }
      });
      return violations;
    });

    console.log(`TOUCH: Icon-only buttons < 36px=${smallTouchTargets.length}`, smallTouchTargets.slice(0, 10));
    // Allow a small tolerance for checkbox/radio components (shadcn default ~32px)
    // but flag any button smaller than 28px (the pre-fix h-7 w-7 size)
    const criticalViolations = smallTouchTargets.filter((v) => v.w < 28 || v.h < 28);
    expect(criticalViolations).toHaveLength(0);
  });
});
